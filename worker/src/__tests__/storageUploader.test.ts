import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks must be defined before the module is imported.
// supabaseAdmin is created at module load time, so we capture the storage mock
// via the vi.mock factory directly — no beforeEach re-assignment needed for the client.

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

// vi.mock is hoisted to top by Vitest — the factory runs before any imports.
// Variables defined with `const` above are hoisted along with vi.mock when using
// `vi.hoisted`, but the simplest fix is to use vi.fn() inline and track via a module-level
// variable captured inside the factory closure. However, factory closures don't access
// module-level consts that aren't hoisted. We use vi.hoisted to make them available.
vi.mock('@supabase/supabase-js', () => {
  const upload = vi.fn().mockResolvedValue({ error: null })
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://example.com/signed' },
    error: null,
  })
  const from = vi.fn(() => ({ upload, createSignedUrl }))
  return {
    createClient: vi.fn(() => ({
      storage: { from },
    })),
    _mocks: { upload, createSignedUrl, from },
  }
})

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('video data')),
}))

import { uploadVideoAndGetUrl, supabaseAdmin, BUCKET } from '../storageUploader.js'
import { readFile } from 'node:fs/promises'

describe('uploadVideoAndGetUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // After clearAllMocks, re-set default resolved values so tests aren't broken by clear
    const storageFrom = supabaseAdmin.storage.from as ReturnType<typeof vi.fn>
    const fromResult = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed' },
        error: null,
      }),
    }
    storageFrom.mockImplementation(() => fromResult)
    ;(readFile as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('video data'))
  })

  it('uploads to jobs/{jobId}/output.mp4 path', async () => {
    await uploadVideoAndGetUrl('/tmp/output.mp4', 'uuid-123')

    const storageFrom = supabaseAdmin.storage.from as ReturnType<typeof vi.fn>
    expect(storageFrom).toHaveBeenCalledWith(BUCKET)

    const fromInstance = storageFrom.mock.results[0].value
    expect(fromInstance.upload).toHaveBeenCalledWith(
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
    const storageFrom = supabaseAdmin.storage.from as ReturnType<typeof vi.fn>
    storageFrom.mockImplementation(() => ({
      upload: vi.fn().mockResolvedValue({ error: new Error('upload failed') }),
      createSignedUrl: vi.fn(),
    }))

    await expect(
      uploadVideoAndGetUrl('/tmp/output.mp4', 'uuid-123'),
    ).rejects.toThrow('upload failed')
  })
})
