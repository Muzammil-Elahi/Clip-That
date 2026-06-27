import { spawn } from 'node:child_process'
import path from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import type { ExpandedWindow } from './contextExpander.js'

// Guard: ffmpeg-static may return null if the binary couldn't be resolved.
// Per RESEARCH.md Pitfall 2.
if (!ffmpegPath) {
  throw new Error('ffmpeg-static returned null — check installation')
}

/**
 * Runs FFmpeg with the provided argument list.
 * Resolves on exit code 0; rejects with stderr output on non-zero exit.
 * Per D-03: direct child_process.spawn, no fluent-ffmpeg.
 */
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args)
    const stderr: string[] = []
    proc.stderr.on('data', (d: Buffer) => stderr.push(d.toString()))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.join('')}`))
    })
    proc.on('error', reject)
  })
}

/**
 * Extracts each ExpandedWindow from sourceFile as a separate segment file.
 * Uses FFmpeg -c copy for stream-copy extraction (no re-encode).
 * -ss/-to are placed AFTER -i (post-input seek) for frame-accurate cutting —
 * pre-input seek (-ss before -i) snaps to the nearest keyframe, which can
 * introduce several seconds of unintended leading content before the target
 * timestamp. Post-input seek decodes up to the cut point (slightly slower)
 * but starts at the exact requested timestamp.
 * Runs each segment sequentially to avoid disk contention.
 * Returns array of output file paths.
 */
export async function extractSegments(
  windows: ExpandedWindow[],
  sourceFile: string,
  tmpDir: string,
): Promise<string[]> {
  const outputPaths: string[] = []

  for (let i = 0; i < windows.length; i++) {
    const window = windows[i]
    const startSec = (window.startMs / 1000).toFixed(3)
    const endSec = (window.endMs / 1000).toFixed(3)
    const outputFile = path.join(tmpDir, `segment-${i}.mp4`)

    await runFfmpeg([
      '-i', sourceFile,
      '-ss', startSec,
      '-to', endSec,
      '-c', 'copy',
      '-y',
      outputFile,
    ])

    outputPaths.push(outputFile)
  }

  return outputPaths
}
