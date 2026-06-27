import type { PrismaClient } from '../../prisma/generated/prisma/client'
import { supabaseAdmin, BUCKET } from './storageUploader.js'

/** Maximum number of expired jobs to clean up per polling tick. Avoids full-table scans. */
const CLEANUP_BATCH_LIMIT = 10

/**
 * Deletes Supabase Storage artifacts for jobs whose videoExpiresAt has passed.
 * Called on every polling tick in main() per D-06.
 * Nulls videoUrl and videoExpiresAt on cleaned-up rows.
 */
export async function cleanupExpiredVideos(prisma: PrismaClient): Promise<void> {
  const expired = await prisma.job.findMany({
    where: {
      videoExpiresAt: { lt: new Date() },
      videoUrl: { not: null },
    },
    select: { id: true },
    take: CLEANUP_BATCH_LIMIT,
  })

  if (expired.length === 0) return

  const storagePaths = expired.map((j) => `jobs/${j.id}/output.mp4`)
  const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove(storagePaths)
  if (removeError) {
    // Log and bail — do NOT null the DB fields; retry next tick
    console.error('cleanupExpiredVideos: storage remove failed:', removeError)
    return
  }

  await prisma.job.updateMany({
    where: { id: { in: expired.map((j) => j.id) } },
    data: { videoUrl: null, videoExpiresAt: null },
  })
}
