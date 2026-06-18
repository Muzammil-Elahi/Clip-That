import { describe, it, expect } from 'vitest'
import { mapTranscriptError } from '../transcript.js'
import {
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptInvalidVideoIdError,
} from 'youtube-transcript-plus'

describe('mapTranscriptError', () => {
  it('returns no-transcript message for YoutubeTranscriptNotAvailableError', () => {
    const err = new YoutubeTranscriptNotAvailableError('vid123')
    expect(mapTranscriptError(err)).toBe("This video doesn't have a usable transcript.")
  })

  it('returns no-transcript message for YoutubeTranscriptDisabledError', () => {
    const err = new YoutubeTranscriptDisabledError('vid123')
    expect(mapTranscriptError(err)).toBe("This video doesn't have a usable transcript.")
  })

  it('returns unavailable message for YoutubeTranscriptVideoUnavailableError', () => {
    const err = new YoutubeTranscriptVideoUnavailableError('vid123')
    expect(mapTranscriptError(err)).toBe("This video is unavailable.")
  })

  it('returns rate-limit message for YoutubeTranscriptTooManyRequestError', () => {
    const err = new YoutubeTranscriptTooManyRequestError('vid123')
    expect(mapTranscriptError(err)).toBe("YouTube is temporarily unavailable. Please try again in a few minutes.")
  })

  it('returns invalid-id message for YoutubeTranscriptInvalidVideoIdError', () => {
    const err = new YoutubeTranscriptInvalidVideoIdError('bad-id')
    expect(mapTranscriptError(err)).toBe("Invalid YouTube video URL.")
  })

  it('returns fallback message for unknown errors', () => {
    const err = new Error('unknown network error')
    expect(mapTranscriptError(err)).toBe("Failed to retrieve transcript. Please try again.")
  })

  it('returns fallback message for non-Error values', () => {
    expect(mapTranscriptError('string error')).toBe("Failed to retrieve transcript. Please try again.")
  })
})
