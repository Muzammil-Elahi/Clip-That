import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

import { stitchSegments } from '../videoStitcher.js'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

describe('stitchSegments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(spawn as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') cb(0)
      }),
    }))
    ;(writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  it('writes filelist.txt and calls ffmpeg with concat demuxer args', async () => {
    await stitchSegments(
      ['/tmp/seg0.mp4', '/tmp/seg1.mp4'],
      '/tmp/output.mp4',
    )

    // writeFile should have been called for filelist.txt
    expect(writeFile).toHaveBeenCalledOnce()
    const writeFileArgs = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]
    const filelistContent = writeFileArgs[1] as string
    expect(filelistContent).toContain("file '/tmp/seg0.mp4'")
    expect(filelistContent).toContain("file '/tmp/seg1.mp4'")

    // spawn should have been called with concat demuxer args
    expect(spawn).toHaveBeenCalledOnce()
    const spawnArgs = (spawn as ReturnType<typeof vi.fn>).mock.calls[0][1] as string[]
    expect(spawnArgs).toContain('-f')
    expect(spawnArgs).toContain('concat')
    expect(spawnArgs).toContain('-safe')
    expect(spawnArgs).toContain('0')
    expect(spawnArgs).toContain('-c')
    expect(spawnArgs).toContain('copy')
  })

  it('rejects when ffmpeg exits non-zero', async () => {
    ;(spawn as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') cb(1)
      }),
    }))

    await expect(
      stitchSegments(['/tmp/seg0.mp4'], '/tmp/output.mp4'),
    ).rejects.toThrow()
  })
})
