import { describe, it, expect } from 'vitest'
import { submitJobSchema } from '@/lib/schemas'

describe('submitJobSchema', () => {
  it('fails validation when both youtubeUrl and topic are empty strings', () => {
    const result = submitJobSchema.safeParse({ youtubeUrl: '', topic: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.flatten()
      expect(errors.fieldErrors.youtubeUrl).toBeDefined()
      expect(errors.fieldErrors.topic).toBeDefined()
    }
  })

  it('fails validation when topic is too short (1 character)', () => {
    const result = submitJobSchema.safeParse({
      youtubeUrl: 'https://www.youtube.com/watch?v=abc1234567A',
      topic: 'x',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.flatten()
      expect(errors.fieldErrors.topic).toContain('Enter at least 2 characters.')
    }
  })

  it('passes validation with a valid YouTube URL and sufficient topic length', () => {
    const result = submitJobSchema.safeParse({
      youtubeUrl: 'https://www.youtube.com/watch?v=abc1234567A',
      topic: 'gradient descent',
    })
    expect(result.success).toBe(true)
  })

  it('fails validation when topic exceeds 200 characters', () => {
    const result = submitJobSchema.safeParse({
      youtubeUrl: 'https://www.youtube.com/watch?v=abc1234567A',
      topic: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.flatten()
      expect(errors.fieldErrors.topic).toContain('Keep it under 200 characters.')
    }
  })

  it('fails validation when youtubeUrl is not a YouTube URL', () => {
    const result = submitJobSchema.safeParse({
      youtubeUrl: 'https://vimeo.com/123456789',
      topic: 'gradient descent',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.flatten()
      expect(errors.fieldErrors.youtubeUrl).toContain('Enter a valid YouTube video URL.')
    }
  })

  it('passes validation with a youtu.be short URL', () => {
    const result = submitJobSchema.safeParse({
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      topic: 'machine learning',
    })
    expect(result.success).toBe(true)
  })

  it('passes validation with topic of exactly 2 characters', () => {
    const result = submitJobSchema.safeParse({
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      topic: 'ai',
    })
    expect(result.success).toBe(true)
  })

  it('passes validation with topic of exactly 200 characters', () => {
    const result = submitJobSchema.safeParse({
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      topic: 'a'.repeat(200),
    })
    expect(result.success).toBe(true)
  })
})
