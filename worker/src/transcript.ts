import { spawn } from 'node:child_process'
import { readFile, readdir, rm, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import { YTDLP_BIN } from './ytdlp.js'
import { getCookiesPath } from './ytCookies.js'
import type { TranscriptSegment } from './types.js'

export class TranscriptUnavailableError extends Error {
  constructor(videoId: string) {
    super(`No transcript available for video ${videoId}`)
    this.name = 'TranscriptUnavailableError'
  }
}

export class VideoUnavailableError extends Error {
  constructor(videoId: string) {
    super(`Video unavailable: ${videoId}`)
    this.name = 'VideoUnavailableError'
  }
}

function parseSrt(content: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  const blocks = content.trim().split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue
    const match = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    )
    if (!match) continue
    const toMs = (h: number, m: number, s: number, ms: number) =>
      h * 3600000 + m * 60000 + s * 1000 + ms
    const startMs = toMs(+match[1], +match[2], +match[3], +match[4])
    const endMs = toMs(+match[5], +match[6], +match[7], +match[8])
    const text = lines.slice(2).join(' ').replace(/<[^>]*>/g, '').trim()
    if (!text) continue
    segments.push({
      text,
      offset: startMs / 1000,
      duration: (endMs - startMs) / 1000,
      lang: 'en',
    })
  }
  return segments
}

export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'transcript-'))
  try {
    const stderr: string[] = []
    const code = await new Promise<number>((resolve, reject) => {
      const cookiesPath = getCookiesPath()
      const proc = spawn(YTDLP_BIN, [
        '--write-auto-subs',
        '--write-subs',
        '--skip-download',
        '--sub-langs', 'en.*',
        '--convert-subs', 'srt',
        '--js-runtimes', 'node',
        ...(cookiesPath ? ['--cookies', cookiesPath] : []),
        ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
        '-o', join(tmpDir, 'video'),
        `https://www.youtube.com/watch?v=${videoId}`,
      ])
      proc.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()))
      proc.on('close', resolve)
      proc.on('error', (err) => reject(new Error(`Failed to start yt-dlp: ${err.message}`)))
    })

    const stderrText = stderr.join('').toLowerCase()
    if (code !== 0) {
      if (stderrText.includes('unavailable') || stderrText.includes('private')) {
        throw new VideoUnavailableError(videoId)
      }
      throw new Error(stderr.join('').trim() || `yt-dlp exited with code ${code}`)
    }

    const files = await readdir(tmpDir)
    const srtFile = files.find(f => f.endsWith('.srt'))
    if (!srtFile) throw new TranscriptUnavailableError(videoId)

    const raw = await readFile(join(tmpDir, srtFile), 'utf-8')
    const segments = parseSrt(raw)
    if (segments.length === 0) throw new TranscriptUnavailableError(videoId)
    return segments
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

export function mapTranscriptError(err: unknown): string {
  if (err instanceof TranscriptUnavailableError) {
    return "This video doesn't have a usable transcript."
  }
  if (err instanceof VideoUnavailableError) {
    return 'This video is unavailable.'
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('unavailable') || msg.includes('private')) {
      return 'This video is unavailable.'
    }
    if (msg.includes('too many') || msg.includes('rate limit')) {
      return 'YouTube is temporarily unavailable. Please try again in a few minutes.'
    }
  }
  return 'Failed to retrieve transcript. Please try again.'
}
