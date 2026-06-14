/**
 * YouTube URL validation and video ID extraction utilities.
 * Covers watch?v=, youtu.be/, shorts/, and embed/ formats.
 */

export const YOUTUBE_REGEX =
  /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

/**
 * Extracts the 11-character YouTube video ID from a URL.
 * Returns null if the URL is not a recognised YouTube URL format.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null
  const match = url.match(YOUTUBE_REGEX)
  return match ? match[1] : null
}

/**
 * Returns true if the URL is a valid YouTube video URL (contains an 11-char video ID).
 */
export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null
}
