import {
  YoutubeTranscript,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptInvalidVideoIdError,
} from 'youtube-transcript-plus'

/**
 * Fetches timestamped transcript segments for a YouTube video.
 * Re-throws all errors — caller is responsible for handling them via mapTranscriptError.
 */
export async function fetchTranscript(videoId: string) {
  return YoutubeTranscript.fetchTranscript(videoId, { retries: 2, retryDelay: 1000 })
}

/**
 * Maps youtube-transcript-plus errors to plain-language user-facing strings.
 * Follows Phase 1 D-11 convention: single sentence, uppercase, period at end, no jargon.
 */
export function mapTranscriptError(err: unknown): string {
  if (
    err instanceof YoutubeTranscriptNotAvailableError ||
    err instanceof YoutubeTranscriptDisabledError
  ) {
    return "This video doesn't have a usable transcript."
  }
  if (err instanceof YoutubeTranscriptVideoUnavailableError) {
    return "This video is unavailable."
  }
  if (err instanceof YoutubeTranscriptTooManyRequestError) {
    return "YouTube is temporarily unavailable. Please try again in a few minutes."
  }
  if (err instanceof YoutubeTranscriptInvalidVideoIdError) {
    return "Invalid YouTube video URL."
  }
  return "Failed to retrieve transcript. Please try again."
}
