import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../storageUploader.js', () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
  BUCKET: 'clip-videos',
}))

import { cleanupExpiredVideos } from '../videoCleanup.js'
import { supabaseAdmin } from '../storageUploader.js'

describe('cleanupExpiredVideos', () => {
  let mockPrisma: {
    job: {
      findMany: ReturnType<typeof vi.fn>
      updateMany: ReturnType<typeof vi.fn>
    }
  }
  let mockRemove: ReturnType<typeof vi.fn>
  let mockStorageFrom: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockRemove = vi.fn().mockResolvedValue({ error: null })
    mockStorageFrom = vi.fn(() => ({ remove: mockRemove }))

    // Re-mock the storage.from reference on the already-imported supabaseAdmin
    vi.mocked(supabaseAdmin.storage.from).mockImplementation(mockStorageFrom)

    mockPrisma = {
      job: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    }
  })

  it('returns early when no expired jobs', async () => {
    mockPrisma.job.findMany.mockResolvedValue([])

    await cleanupExpiredVideos(mockPrisma as never)

    expect(mockPrisma.job.updateMany).not.toHaveBeenCalled()
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('deletes storage paths and nulls DB fields for expired jobs', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      { id: 'uuid-1' },
      { id: 'uuid-2' },
    ])

    await cleanupExpiredVideos(mockPrisma as never)

    expect(mockRemove).toHaveBeenCalledWith([
      'jobs/uuid-1/output.mp4',
      'jobs/uuid-2/output.mp4',
    ])
    expect(mockPrisma.job.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { videoUrl: null, videoExpiresAt: null },
      }),
    )
  })

  it('respects CLEANUP_BATCH_LIMIT of 10', async () => {
    await cleanupExpiredVideos(mockPrisma as never)

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    )
  })
})
