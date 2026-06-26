import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@distube/ytdl-core', () => ({
  default: vi.fn(() => ({
    pipe: vi.fn(),
    on: vi.fn(),
    read: vi.fn(),
  })),
}))

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(() => ({})),
}))

import { downloadYouTubeVideo, mapVideoError } from '../videoDownloader.js'
import ytdl from '@distube/ytdl-core'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'

describe('downloadYouTubeVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(pipeline as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  it('calls pipeline with ytdl stream and write stream for valid URL', async () => {
    const mockStream = { pipe: vi.fn(), on: vi.fn(), read: vi.fn() }
    ;(ytdl as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockStream)
    const mockWriteStream = {}
    ;(createWriteStream as ReturnType<typeof vi.fn>).mockReturnValue(mockWriteStream)

    await downloadYouTubeVideo('https://www.youtube.com/watch?v=test123', '/tmp/out.mp4')

    expect(pipeline).toHaveBeenCalledOnce()
    expect(pipeline).toHaveBeenCalledWith(mockStream, mockWriteStream)
  })

  it('throws when pipeline rejects', async () => {
    const mockStream = { pipe: vi.fn(), on: vi.fn(), read: vi.fn() }
    ;(ytdl as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockStream)
    ;(pipeline as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('stream error'))

    await expect(
      downloadYouTubeVideo('https://www.youtube.com/watch?v=test123', '/tmp/out.mp4'),
    ).rejects.toThrow('stream error')
  })
})

describe('mapVideoError', () => {
  it('returns specific message for Error instances', () => {
    const result = mapVideoError(new Error('FFmpeg crashed'))
    expect(result).toBe('FFmpeg crashed')
  })

  it('returns generic message for non-Error values', () => {
    const result = mapVideoError('unexpected string error')
    expect(result).toBe('Video processing failed. Please try again.')
  })
})
