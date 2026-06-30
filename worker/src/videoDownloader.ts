import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
import { YTDLP_BIN } from './ytdlp.js'
import { getCookiesPath } from './ytCookies.js'

export async function downloadYouTubeVideo(
  youtubeUrl: string,
  destPath: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cookiesPath = getCookiesPath()
    const args = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--js-runtimes', 'node',
      ...(cookiesPath ? ['--cookies', cookiesPath] : []),
      ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
      '-o', destPath,
      youtubeUrl,
    ]
    const proc = spawn(YTDLP_BIN, args)

    const stderr: string[] = []
    proc.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()))

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(stderr.join('').trim() || `yt-dlp exited with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}`))
    })
  })
}

/**
 * Maps video processing errors to plain-language user-facing strings.
 * Follows Phase 1 D-11 convention: single sentence, period at end, no jargon.
 * Never surfaces raw internal messages (FFmpeg stderr, ENOENT paths, etc.) to end users.
 */
export function mapVideoError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('ffmpeg')) return 'Video processing failed. Please try again.'
    if (msg.includes('enoent') || msg.includes('no such file')) return 'Video processing failed. Please try again.'
    if (
      msg.includes('status code') ||
      msg.includes('403') ||
      msg.includes('410') ||
      msg.includes('private') ||
      msg.includes('unavailable') ||
      msg.includes('not available')
    ) {
      return 'This video could not be downloaded. It may be private or region-restricted.'
    }
  }
  return 'Video processing failed. Please try again.'
}
