import { describe, it, expect } from 'vitest'
import { normalize, findMatches, buildClipPlan } from '../matcher.js'
import type { TranscriptSegment } from '../types.js'

describe('normalize', () => {
  it('lowercases input', () => {
    expect(normalize('Hello World')).toBe('hello world')
  })

  it('strips punctuation', () => {
    expect(normalize('Hello, World!')).toBe('hello world')
  })

  it('collapses multiple whitespace into one space', () => {
    expect(normalize('  multiple   spaces  ')).toBe('multiple spaces')
  })

  it('strips apostrophes (non-word chars)', () => {
    expect(normalize("it's working")).toBe('its working')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalize('  hello  ')).toBe('hello')
  })
})

describe('findMatches', () => {
  it('returns empty array when segments is empty', () => {
    expect(findMatches([], 'anything')).toEqual([])
  })

  it('returns empty array when topic not in transcript', () => {
    const segments: TranscriptSegment[] = [
      { text: 'hello world', offset: 5, duration: 2, lang: 'en' },
    ]
    expect(findMatches(segments, 'not here')).toEqual([])
  })

  it('returns match with correct ms values for single-segment match (D-07)', () => {
    const segments: TranscriptSegment[] = [
      { text: 'machine learning is great', offset: 10, duration: 3, lang: 'en' },
    ]
    const result = findMatches(segments, 'machine learning')
    expect(result).toHaveLength(1)
    expect(result[0].startMs).toBe(10000)
    expect(result[0].endMs).toBe(13000)
    expect(result[0].text).toBe('machine learning is great')
    expect(result[0].segmentIndices).toEqual([0])
  })

  it('matches across consecutive segment boundary (D-08 cross-boundary)', () => {
    const segments: TranscriptSegment[] = [
      { text: 'machine', offset: 10, duration: 1, lang: 'en' },
      { text: 'learning today', offset: 11, duration: 2, lang: 'en' },
    ]
    const result = findMatches(segments, 'machine learning')
    expect(result).toHaveLength(1)
    expect(result[0].startMs).toBe(10000)
    expect(result[0].endMs).toBe(13000)
    expect(result[0].text).toBe('machine learning today')
    expect(result[0].segmentIndices).toEqual([0, 1])
  })

  it('returns multiple matches when topic appears more than once', () => {
    const segments: TranscriptSegment[] = [
      { text: 'neural networks are cool', offset: 0, duration: 2, lang: 'en' },
      { text: 'some other content', offset: 2, duration: 2, lang: 'en' },
      { text: 'neural networks again', offset: 4, duration: 2, lang: 'en' },
    ]
    const result = findMatches(segments, 'neural networks')
    expect(result).toHaveLength(2)
    expect(result[0].segmentIndices).toEqual([0])
    expect(result[1].segmentIndices).toEqual([2])
  })

  it('does not use seg.start (only seg.offset) — no NaN in output', () => {
    const segments: TranscriptSegment[] = [
      { text: 'machine learning', offset: 5, duration: 2, lang: 'en' },
    ]
    const result = findMatches(segments, 'machine learning')
    expect(result[0].startMs).not.toBeNaN()
    expect(result[0].endMs).not.toBeNaN()
  })
})

describe('buildClipPlan', () => {
  it('aliases findMatches — returns same result for same input', () => {
    const segments: TranscriptSegment[] = [
      { text: 'machine learning is great', offset: 10, duration: 3, lang: 'en' },
    ]
    expect(buildClipPlan(segments, 'machine learning')).toEqual(
      findMatches(segments, 'machine learning')
    )
  })

  it('returns empty array when no matches (no-match → DONE with empty clipPlan, not FAILED)', () => {
    expect(buildClipPlan([], 'anything')).toEqual([])
  })
})
