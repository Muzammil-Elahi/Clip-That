import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../prisma/generated/prisma/client'
import { fetchTranscript, mapTranscriptError } from './transcript.js'
import { extractYouTubeVideoId } from './youtube.js'
import { buildClipPlan } from './matcher.js'
import { expandContextWindows, mergeOverlappingWindows } from './contextExpander.js'
import { buildStitchedTranscript } from './stitchedTranscript.js'
import { Prisma } from '../../prisma/generated/prisma/client'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../.env.local') })

if (!process.env.WORKER_DATABASE_URL && !process.env.DATABASE_URL) {
  console.error('WORKER_DATABASE_URL is not set in .env.local — cannot connect to database')
  process.exit(1)
}

const connectionString = (process.env.WORKER_DATABASE_URL ?? process.env.DATABASE_URL)!
const pool = new pg.Pool({ connectionString, family: 4 })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

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

    const clipPlan = buildClipPlan(segments, job.topic)
    console.log(`  clipPlan: ${clipPlan.length} matches`)

    const expandedWindows = expandContextWindows(segments, clipPlan)
    const mergedWindows = mergeOverlappingWindows(expandedWindows)
    const stitchedTranscript = buildStitchedTranscript(segments, mergedWindows)
    console.log(`  stitchedTranscript: ${stitchedTranscript.length} entries`)

    console.log('  writing DONE...')
    await prisma.job.update({
      where: { id: job.id },
      data: {
        transcript: segments as unknown as Prisma.InputJsonValue,
        clipPlan: clipPlan as unknown as Prisma.InputJsonValue,
        stitchedTranscript: stitchedTranscript as unknown as Prisma.InputJsonValue,
        status: 'DONE',
      },
    })
    console.log('  DONE ✓')
  } catch (err) {
    console.error('  ERROR:', err)
    const errorMessage = mapTranscriptError(err)
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
    await processPendingJob()
    process.stdout.write('done\n')
    await sleep(4000)
  }
}

main().catch(err => {
  console.error('Worker fatal error:', err)
  process.exit(1)
})
