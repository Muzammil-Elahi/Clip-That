import { describe, it, expect } from 'vitest'
import { extractYouTubeVideoId, isYouTubeUrl } from '@/lib/youtube'

describe('extractYouTubeVideoId', () => {
  it('extracts video ID from standard watch URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts video ID from youtu.be short URL', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts video ID from YouTube Shorts URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts video ID from embed URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for a non-YouTube URL', () => {
    expect(extractYouTubeVideoId('https://example.com/video')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(extractYouTubeVideoId('')).toBeNull()
  })

  it('returns null for a Vimeo URL', () => {
    expect(extractYouTubeVideoId('https://vimeo.com/123456789')).toBeNull()
  })
})

describe('isYouTubeUrl', () => {
  it('returns true for a valid watch URL with 11-char video ID', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc1234567A')).toBe(true)
  })

  it('returns false for a Vimeo URL', () => {
    expect(isYouTubeUrl('https://vimeo.com/123456')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isYouTubeUrl('')).toBe(false)
  })

  it('returns true for a youtu.be URL', () => {
    expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
  })

  it('returns true for a Shorts URL', () => {
    expect(isYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true)
  })
})
