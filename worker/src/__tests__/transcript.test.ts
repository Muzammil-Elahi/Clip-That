import { describe, it, expect } from 'vitest'
import { mapTranscriptError, TranscriptUnavailableError, VideoUnavailableError } from '../transcript.js'

describe('mapTranscriptError', () => {
  it('returns no-transcript message for TranscriptUnavailableError', () => {
    expect(mapTranscriptError(new TranscriptUnavailableError('vid123')))
      .toBe("This video doesn't have a usable transcript.")
  })

  it('returns unavailable message for VideoUnavailableError', () => {
    expect(mapTranscriptError(new VideoUnavailableError('vid123')))
      .toBe('This video is unavailable.')
  })

  it('returns rate-limit message for rate-limit errors', () => {
    expect(mapTranscriptError(new Error('yt-dlp: too many requests')))
      .toBe('YouTube is temporarily unavailable. Please try again in a few minutes.')
  })

  it('returns fallback message for unknown errors', () => {
    expect(mapTranscriptError(new Error('unknown network error')))
      .toBe('Failed to retrieve transcript. Please try again.')
  })

  it('returns fallback message for non-Error values', () => {
    expect(mapTranscriptError('string error'))
      .toBe('Failed to retrieve transcript. Please try again.')
  })
})
