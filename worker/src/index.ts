import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from './prisma.js'
import { fetchTranscript, mapTranscriptError } from './transcript.js'
import { extractYouTubeVideoId } from './youtube.js'
import { Prisma } from '../../prisma/generated/prisma/client'

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

let shutdown = false
let processingJob = false

process.on('SIGTERM', async () => {
  shutdown = true
  // Wait for in-flight job to finish before exit
  while (processingJob) await sleep(200)
  await prisma.$disconnect()
  process.exit(0)
})

async function processPendingJob(): Promise<void> {
  const job = await prisma.job.findFirst({ where: { status: 'PENDING' } })
  if (!job) return

  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'PROCESSING' },
  })

  processingJob = true
  try {
    const videoId = extractYouTubeVideoId(job.youtubeUrl)
    if (!videoId) throw new Error('Invalid YouTube URL')

    const segments = await fetchTranscript(videoId)

    await prisma.job.update({
      where: { id: job.id },
      data: {
        transcript: segments as unknown as Prisma.InputJsonValue,
        clipPlan: [] as unknown as Prisma.InputJsonValue,
        status: 'DONE',
      },
    })
  } catch (err) {
    const errorMessage = mapTranscriptError(err)
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
  while (!shutdown) {
    await processPendingJob()
    await sleep(4000)
  }
}

main().catch(err => {
  console.error('Worker fatal error:', err)
  process.exit(1)
})
