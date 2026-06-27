import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'

const mockProc = new EventEmitter() as EventEmitter & {
  stderr: EventEmitter
  on: ReturnType<typeof vi.fn>
}
mockProc.stderr = new EventEmitter()

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => mockProc),
}))

vi.mock('ffmpeg-static', () => ({ default: '/mock/ffmpeg' }))

import { downloadYouTubeVideo, mapVideoError } from '../videoDownloader.js'
import { spawn } from 'node:child_process'

describe('downloadYouTubeVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockProc)
    mockProc.removeAllListeners()
    mockProc.stderr.removeAllListeners()
  })

  it('resolves when yt-dlp exits with code 0', async () => {
    const promise = downloadYouTubeVideo('https://www.youtube.com/watch?v=test123', '/tmp/out.mp4')
    mockProc.emit('close', 0)
    await expect(promise).resolves.toBeUndefined()

    expect(spawn).toHaveBeenCalledOnce()
    const [, args] = (spawn as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(args).toContain('https://www.youtube.com/watch?v=test123')
    expect(args).toContain('/tmp/out.mp4')
    expect(args).toContain('--ffmpeg-location')
    expect(args).toContain('/mock/ffmpeg')
  })

  it('rejects when yt-dlp exits with non-zero code', async () => {
    const promise = downloadYouTubeVideo('https://www.youtube.com/watch?v=test123', '/tmp/out.mp4')
    mockProc.emit('close', 1)
    await expect(promise).rejects.toThrow('yt-dlp exited with code 1')
  })

  it('rejects when spawn emits error', async () => {
    const promise = downloadYouTubeVideo('https://www.youtube.com/watch?v=test123', '/tmp/out.mp4')
    mockProc.emit('error', new Error('ENOENT'))
    await expect(promise).rejects.toThrow('Failed to start yt-dlp')
  })
})

describe('mapVideoError', () => {
  it('returns plain-language message for ffmpeg errors', () => {
    expect(mapVideoError(new Error('FFmpeg crashed'))).toBe(
      'Video processing failed. Please try again.',
    )
  })

  it('returns region-restricted message for HTTP 403 errors', () => {
    expect(mapVideoError(new Error('Request failed with status code 403'))).toBe(
      'This video could not be downloaded. It may be private or region-restricted.',
    )
  })

  it('returns region-restricted message for private video errors', () => {
    expect(mapVideoError(new Error('Video is private'))).toBe(
      'This video could not be downloaded. It may be private or region-restricted.',
    )
  })

  it('returns generic message for non-Error values', () => {
    expect(mapVideoError('unexpected string error')).toBe(
      'Video processing failed. Please try again.',
    )
  })
})
