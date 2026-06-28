import './env-setup.js'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../prisma/generated/prisma/client'
import { fetchTranscript, mapTranscriptError } from './transcript.js'
import { extractYouTubeVideoId } from './youtube.js'
import { buildClipPlan } from './matcher.js'
import { findSemanticMatches } from './semanticMatcher.js'
import type { ClipMatch } from './types.js'
import { expandContextWindows, mergeOverlappingWindows } from './contextExpander.js'
import { buildStitchedTranscript } from './stitchedTranscript.js'
import { generateStudyNotes } from './notesGenerator.js'
import { Prisma } from '../../prisma/generated/prisma/client'
import { downloadYouTubeVideo, mapVideoError } from './videoDownloader.js'
import { extractSegments } from './videoExtractor.js'
import { stitchSegments } from './videoStitcher.js'
import { uploadVideoAndGetUrl, RETENTION_MS } from './storageUploader.js'
import { cleanupExpiredVideos } from './videoCleanup.js'
import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

if (!process.env.WORKER_DATABASE_URL && !process.env.DATABASE_URL) {
  console.error('WORKER_DATABASE_URL is not set in .env.local — cannot connect to database')
  process.exit(1)
}

const connectionString = (process.env.WORKER_DATABASE_URL ?? process.env.DATABASE_URL)!
const pool = new pg.Pool({ connectionString, family: 4 })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

/**
 * Creates a job-scoped temp directory, runs fn with its path, and always removes it.
 * The finally block guarantees cleanup even if an error is thrown inside fn.
 * Per RESEARCH.md Pattern 5.
 */
async function withTempDir<T>(
  jobId: string,
  fn: (tmpDir: string) => Promise<T>,
): Promise<T> {
  const tmpDir = path.join(os.tmpdir(), `clip-that-${jobId}`)
  await mkdir(tmpDir, { recursive: true })
  try {
    return await fn(tmpDir)
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

let shutdown = false
let processingJob = false

process.on('SIGTERM', async () => {
  shutdown = true
  while (processingJob) await sleep(200)
  await prisma.$disconnect()
  process.exit(0)
})

async function processPendingJob(): Promise<void> {
  const job = await prisma.job.findFirst({ where: { status: 'PENDING' } })
  if (!job) { process.stdout.write('no pending jobs. '); return }
  console.log(`\nPicked up job ${job.id} (${job.youtubeUrl}, topic: "${job.topic}")`)

  processingJob = true
  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'PROCESSING' },
  })

  try {
    const videoId = extractYouTubeVideoId(job.youtubeUrl)
    if (!videoId) throw new Error('Invalid YouTube URL')
    console.log(`  videoId: ${videoId}`)

    console.log('  fetching transcript...')
    const segments = await fetchTranscript(videoId)
    console.log(`  got ${segments.length} segments`)

    const exactMatches = buildClipPlan(segments, job.topic)
    console.log(`  clipPlan (exact): ${exactMatches.length} matches`)

    // Phase 6: optional semantic matching — guarded by job.semanticEnabled
    let semanticMatches: ClipMatch[] = []
    let semanticFailed = false
    if (job.semanticEnabled) {
      try {
        semanticMatches = await findSemanticMatches(segments, job.topic)
        console.log(`  semantic matches: ${semanticMatches.length}`)
      } catch (err) {
        console.error('  Semantic matching failed (soft-fail, exact matches preserved):', err)
        semanticFailed = true
      }
    }
    const exactIndices = new Set(exactMatches.flatMap(m => m.segmentIndices))
    const dedupedSemantic = semanticMatches.filter(m => !m.segmentIndices.some(i => exactIndices.has(i)))
    const clipPlan = [...exactMatches, ...dedupedSemantic]
    console.log(JSON.stringify({ event: 'semantic_matching_complete', jobId: job.id, semanticEnabled: job.semanticEnabled, exactMatchCount: exactMatches.length, semanticMatchCount: dedupedSemantic.length }))

    const expandedWindows = expandContextWindows(segments, clipPlan)
    const mergedWindows = mergeOverlappingWindows(expandedWindows)
    const stitchedTranscript = buildStitchedTranscript(segments, mergedWindows)
    console.log(`  stitchedTranscript: ${stitchedTranscript.length} entries`)

    // Phase 5: study notes generation
    console.log('  generating study notes...')
    const studyNotes = await generateStudyNotes(stitchedTranscript, job.topic)
    if (studyNotes) {
      console.log('  study notes generated ✓')
    } else {
      console.log('  study notes soft-failed (null) — job will still complete')
    }

    // Phase 4: video pipeline — download, extract, stitch, upload
    let videoUrl: string | null = null
    if (mergedWindows.length > 0) {
      videoUrl = await withTempDir(job.id, async (tmpDir) => {
        const sourceFile = path.join(tmpDir, 'source.mp4')
        const outputFile = path.join(tmpDir, 'output.mp4')

        console.log('  downloading source video...')
        await downloadYouTubeVideo(`https://www.youtube.com/watch?v=${videoId}`, sourceFile)

        console.log('  extracting segments...')
        const segmentFiles = await extractSegments(mergedWindows, sourceFile, tmpDir)

        console.log('  stitching segments...')
        await stitchSegments(segmentFiles, outputFile)

        console.log('  uploading to Supabase Storage...')
        return await uploadVideoAndGetUrl(outputFile, job.id)
      })
    }

    console.log('  writing DONE...')
    await prisma.job.update({
      where: { id: job.id },
      data: {
        transcript: segments as unknown as Prisma.InputJsonValue,
        clipPlan: clipPlan as unknown as Prisma.InputJsonValue,
        stitchedTranscript: stitchedTranscript as unknown as Prisma.InputJsonValue,
        videoUrl,
        videoExpiresAt: videoUrl ? new Date(Date.now() + RETENTION_MS) : null,
        studyNotes,        // string | null — Text? column, no cast needed (per D-03 / PATTERNS.md)
        semanticFailed,
        status: 'DONE',
      },
    })
    console.log('  DONE ✓')
  } catch (err) {
    console.error('  ERROR:', err)
    // Prefer transcript-specific messages; fall back to video error mapping for pipeline errors
    const transcriptMsg = mapTranscriptError(err)
    const errorMessage = transcriptMsg !== 'Failed to retrieve transcript. Please try again.'
      ? transcriptMsg
      : mapVideoError(err)
    console.log(`  writing FAILED: ${errorMessage}`)
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'FAILED', errorMessage },
    })
  } finally {
    processingJob = false
  }
}

async function main() {
  console.log('Worker started, polling for PENDING jobs...')
  let tick = 0
  while (!shutdown) {
    tick++
    process.stdout.write(`[tick ${tick}] polling... `)
    await cleanupExpiredVideos(prisma)  // Phase 4: delete expired storage artifacts per D-06
    await processPendingJob()
    process.stdout.write('done\n')
    await sleep(4000)
  }
}

main().catch(err => {
  console.error('Worker fatal error:', err)
  process.exit(1)
})
