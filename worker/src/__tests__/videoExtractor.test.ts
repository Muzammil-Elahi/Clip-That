import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExpandedWindow } from '../contextExpander.js'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: (code: number) => void) => {
      if (event === 'close') cb(0)
    }),
  })),
}))

vi.mock('ffmpeg-static', () => ({
  default: '/usr/bin/ffmpeg',
}))

import { extractSegments, runFfmpeg } from '../videoExtractor.js'
import { spawn } from 'node:child_process'

describe('runFfmpeg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(spawn as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') cb(0)
      }),
    }))
  })

  it('resolves when ffmpeg exits with code 0', async () => {
    await expect(runFfmpeg(['-version'])).resolves.toBeUndefined()
  })

  it('rejects when ffmpeg exits non-zero', async () => {
    ;(spawn as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      stderr: { on: vi.fn((event: string, cb: (data: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from('error output'))
      }) },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') cb(1)
      }),
    }))
    await expect(runFfmpeg(['-bad-arg'])).rejects.toThrow('FFmpeg exited 1')
  })
})

describe('extractSegments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(spawn as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') cb(0)
      }),
    }))
  })

  it('extracts single segment with correct -ss/-to args', async () => {
    const windows: ExpandedWindow[] = [
      { startIdx: 0, endIdx: 0, startMs: 65000, endMs: 125000 },
    ]
    await extractSegments(windows, '/tmp/source.mp4', '/tmp/job1/')

    expect(spawn).toHaveBeenCalledOnce()
    const spawnArgs = (spawn as ReturnType<typeof vi.fn>).mock.calls[0][1] as string[]
    expect(spawnArgs).toContain('-ss')
    expect(spawnArgs).toContain('65.000')
    expect(spawnArgs).toContain('-to')
    expect(spawnArgs).toContain('125.000')
    expect(spawnArgs).toContain('-c')
    expect(spawnArgs).toContain('copy')
  })

  it('returns array of segment file paths with length matching window count', async () => {
    const windows: ExpandedWindow[] = [
      { startIdx: 0, endIdx: 0, startMs: 65000, endMs: 125000 },
      { startIdx: 1, endIdx: 1, startMs: 200000, endMs: 260000 },
    ]
    const result = await extractSegments(windows, '/tmp/source.mp4', '/tmp/job1/')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('segment-0.mp4')
    expect(result[1]).toContain('segment-1.mp4')
  })

  it('rejects when ffmpeg exits non-zero', async () => {
    ;(spawn as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') cb(1)
      }),
    }))
    const windows: ExpandedWindow[] = [
      { startIdx: 0, endIdx: 0, startMs: 0, endMs: 5000 },
    ]
    await expect(
      extractSegments(windows, '/tmp/source.mp4', '/tmp/job1/'),
    ).rejects.toThrow()
  })
})
