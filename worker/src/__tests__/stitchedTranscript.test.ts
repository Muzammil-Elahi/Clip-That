import { describe, it, expect } from 'vitest'
import { buildStitchedTranscript } from '../stitchedTranscript.js'
import type { TranscriptSegment } from '../types.js'
import type { ExpandedWindow } from '../contextExpander.js'

describe('buildStitchedTranscript', () => {
  it('returns empty array when mergedWindows is empty (STR-01: empty clipPlan)', () => {
    const segments: TranscriptSegment[] = [
      { text: 'hello', offset: 0, duration: 5, lang: 'en' },
    ]
    expect(buildStitchedTranscript(segments, [])).toEqual([])
  })

  it('returns single entry for single-segment window', () => {
    const segments: TranscriptSegment[] = [
      { text: 'alpha', offset: 5, duration: 3, lang: 'en' },
    ]
    const windows: ExpandedWindow[] = [
      { startIdx: 0, endIdx: 0, startMs: 5000, endMs: 8000 },
    ]
    const result = buildStitchedTranscript(segments, windows)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('alpha')
    expect(result[0].sourceStartMs).toBe(5000)
    expect(result[0].sourceEndMs).toBe(8000)
  })

  it('returns multiple entries in order for multi-segment window', () => {
    const segments: TranscriptSegment[] = [
      { text: 'one', offset: 0, duration: 2, lang: 'en' },
      { text: 'two', offset: 2, duration: 3, lang: 'en' },
      { text: 'three', offset: 5, duration: 4, lang: 'en' },
      { text: 'four', offset: 9, duration: 2, lang: 'en' },
      { text: 'five', offset: 11, duration: 3, lang: 'en' },
    ]
    // Single window covering indices 2..4
    const windows: ExpandedWindow[] = [
      { startIdx: 2, endIdx: 4, startMs: 5000, endMs: 14000 },
    ]
    const result = buildStitchedTranscript(segments, windows)
    expect(result).toHaveLength(3)
    expect(result[0].text).toBe('three')
    expect(result[0].sourceStartMs).toBe(Math.round(segments[2].offset * 1000))
    expect(result[0].sourceEndMs).toBe(Math.round((segments[2].offset + segments[2].duration) * 1000))
    expect(result[1].text).toBe('four')
    expect(result[2].text).toBe('five')
  })

  it('sourceStartMs and sourceEndMs are not NaN (CLP-04)', () => {
    const segments: TranscriptSegment[] = [
      { text: 'test', offset: 7.5, duration: 2.3, lang: 'en' },
    ]
    const windows: ExpandedWindow[] = [
      { startIdx: 0, endIdx: 0, startMs: 7500, endMs: 9800 },
    ]
    const result = buildStitchedTranscript(segments, windows)
    expect(result[0].sourceStartMs).not.toBeNaN()
    expect(result[0].sourceEndMs).not.toBeNaN()
    expect(result[0].sourceStartMs).toBe(Math.round(7.5 * 1000))
    expect(result[0].sourceEndMs).toBe(Math.round((7.5 + 2.3) * 1000))
  })

  it('produces entries from multiple non-adjacent windows without gap markers (D-05)', () => {
    const segments: TranscriptSegment[] = [
      { text: 'seg0', offset: 0, duration: 5, lang: 'en' },
      { text: 'seg1', offset: 5, duration: 5, lang: 'en' },
      { text: 'seg2', offset: 10, duration: 5, lang: 'en' },
      { text: 'seg3', offset: 15, duration: 5, lang: 'en' },
      { text: 'seg4', offset: 20, duration: 5, lang: 'en' },
      { text: 'seg5', offset: 25, duration: 5, lang: 'en' },
    ]
    // Two non-adjacent windows: indices 0..1 and indices 4..5
    const windows: ExpandedWindow[] = [
      { startIdx: 0, endIdx: 1, startMs: 0, endMs: 10000 },
      { startIdx: 4, endIdx: 5, startMs: 20000, endMs: 30000 },
    ]
    const result = buildStitchedTranscript(segments, windows)
    // 2 + 2 = 4 entries, no gap markers
    expect(result).toHaveLength(4)
    expect(result[0].text).toBe('seg0')
    expect(result[1].text).toBe('seg1')
    expect(result[2].text).toBe('seg4')
    expect(result[3].text).toBe('seg5')
    // No gap marker objects — all entries have sourceStartMs, sourceEndMs, text
    for (const entry of result) {
      expect(entry).toHaveProperty('sourceStartMs')
      expect(entry).toHaveProperty('sourceEndMs')
      expect(entry).toHaveProperty('text')
      expect(Object.keys(entry)).toHaveLength(3)
    }
  })
})
