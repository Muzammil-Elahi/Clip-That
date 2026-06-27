import ytdl from '@distube/ytdl-core'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

/**
 * Downloads a YouTube video to a local file path via streaming.
 * Filters to combined mp4 format (video + audio) at highest quality.
 * Re-throws all errors — caller handles them via mapVideoError.
 * Per D-02: @distube/ytdl-core is locked; yt-dlp is the upgrade path if this breaks.
 */
export async function downloadYouTubeVideo(
  youtubeUrl: string,
  destPath: string,
): Promise<void> {
  const stream = ytdl(youtubeUrl, {
    filter: (fmt) => fmt.container === 'mp4' && fmt.hasVideo && fmt.hasAudio,
    quality: 'highest',
  })
  await pipeline(stream as unknown as NodeJS.ReadableStream, createWriteStream(destPath))
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
    if (msg.includes('status code') || msg.includes('403') || msg.includes('410')) {
      return 'This video could not be downloaded. It may be private or region-restricted.'
    }
  }
  return 'Video processing failed. Please try again.'
}
