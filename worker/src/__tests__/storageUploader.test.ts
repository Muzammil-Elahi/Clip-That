import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpload = vi.fn().mockResolvedValue({ error: null })
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: 'https://example.com/signed' },
  error: null,
})
const mockRemove = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn(() => ({
  upload: mockUpload,
  createSignedUrl: mockCreateSignedUrl,
  remove: mockRemove,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: mockFrom,
    },
  })),
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('video data')),
}))

import { uploadVideoAndGetUrl } from '../storageUploader.js'
import { readFile } from 'node:fs/promises'

describe('uploadVideoAndGetUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ error: null })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
      error: null,
    })
    ;(readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('video data'))
    mockFrom.mockImplementation(() => ({
      upload: mockUpload,
      createSignedUrl: mockCreateSignedUrl,
      remove: mockRemove,
    }))
  })

  it('uploads to jobs/{jobId}/output.mp4 path', async () => {
    await uploadVideoAndGetUrl('/tmp/output.mp4', 'uuid-123')

    expect(mockFrom).toHaveBeenCalledWith('clip-videos')
    expect(mockUpload).toHaveBeenCalledWith(
      'jobs/uuid-123/output.mp4',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'video/mp4' }),
    )
  })

  it('returns the signedUrl from createSignedUrl', async () => {
    const result = await uploadVideoAndGetUrl('/tmp/output.mp4', 'uuid-123')
    expect(result).toBe('https://example.com/signed')
  })

  it('throws when upload returns error', async () => {
    mockUpload.mockResolvedValue({ error: new Error('upload failed') })

    await expect(
      uploadVideoAndGetUrl('/tmp/output.mp4', 'uuid-123'),
    ).rejects.toThrow('upload failed')
  })
})
