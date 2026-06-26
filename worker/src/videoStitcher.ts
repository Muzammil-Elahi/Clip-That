import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { runFfmpeg } from './videoExtractor.js'

/**
 * Stitches multiple segment files into one output mp4 using FFmpeg's concat demuxer.
 * Uses -c copy for stream-copy stitching (no re-encode) — all segments from same source.
 * Per D-03 and RESEARCH.md Pattern 3.
 */
export async function stitchSegments(
  segmentPaths: string[],
  outputPath: string,
): Promise<void> {
  const filelistPath = path.join(path.dirname(outputPath), 'filelist.txt')

  // Build filelist.txt content — escape single quotes in paths per PATTERNS.md
  const filelist = segmentPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join('\n')

  await writeFile(filelistPath, filelist, 'utf8')

  await runFfmpeg([
    '-f', 'concat',
    '-safe', '0',      // allow absolute paths in filelist
    '-i', filelistPath,
    '-c', 'copy',
    '-y',
    outputPath,
  ])
}
