import { describe, it, expect } from 'vitest'
import { expandContextWindows, mergeOverlappingWindows, CONTEXT_WINDOW_MS } from '../contextExpander.js'
import type { TranscriptSegment } from '../types.js'
import type { ClipMatch } from '../types.js'

describe('expandContextWindows', () => {
  it('returns empty array when matches is empty', () => {
    const segments: TranscriptSegment[] = [
      { text: 'hello', offset: 0, duration: 5, lang: 'en' },
    ]
    expect(expandContextWindows(segments, [])).toEqual([])
  })

  it('CONTEXT_WINDOW_MS is 30000 (30 seconds)', () => {
    expect(CONTEXT_WINDOW_MS).toBe(30_000)
  })

  it('expands window to the left and right up to 30s for mid-video match', () => {
    // 20 segments, each 5s duration. Segments 0-19 at offsets 0,5,10,...,95
    // Match at index 10. Walk left: need 30s => 6 segments left = index 4.
    // Walk right: need 30s => 6 segments right = index 16.
    const segments: TranscriptSegment[] = Array.from({ length: 20 }, (_, i) => ({
      text: `segment ${i}`,
      offset: i * 5,
      duration: 5,
      lang: 'en',
    }))
    const matches: ClipMatch[] = [
      { startMs: 50000, endMs: 55000, text: 'segment 10', segmentIndices: [10] },
    ]
    const result = expandContextWindows(segments, matches)
    expect(result).toHaveLength(1)
    // Should expand: startIdx < 10, endIdx > 10
    expect(result[0].startIdx).toBeLessThan(10)
    expect(result[0].endIdx).toBeGreaterThan(10)
    // startMs and endMs should not be NaN
    expect(result[0].startMs).not.toBeNaN()
    expect(result[0].endMs).not.toBeNaN()
    // startMs derived from offset of leftmost segment
    expect(result[0].startMs).toBe(Math.round(segments[result[0].startIdx].offset * 1000))
    // endMs derived from offset + duration of rightmost segment
    const rightSeg = segments[result[0].endIdx]
    expect(result[0].endMs).toBe(Math.round((rightSeg.offset + rightSeg.duration) * 1000))
  })

  it('truncates silently at video start (match at index 0)', () => {
    const segments: TranscriptSegment[] = Array.from({ length: 10 }, (_, i) => ({
      text: `segment ${i}`,
      offset: i * 5,
      duration: 5,
      lang: 'en',
    }))
    const matches: ClipMatch[] = [
      { startMs: 0, endMs: 5000, text: 'segment 0', segmentIndices: [0] },
    ]
    const result = expandContextWindows(segments, matches)
    expect(result).toHaveLength(1)
    expect(result[0].startIdx).toBe(0)
    expect(result[0].startMs).toBe(0)
    // no error thrown
  })

  it('truncates silently at video end (match at last segment)', () => {
    const segments: TranscriptSegment[] = Array.from({ length: 10 }, (_, i) => ({
      text: `segment ${i}`,
      offset: i * 5,
      duration: 5,
      lang: 'en',
    }))
    const lastIdx = segments.length - 1
    const matches: ClipMatch[] = [
      {
        startMs: Math.round(segments[lastIdx].offset * 1000),
        endMs: Math.round((segments[lastIdx].offset + segments[lastIdx].duration) * 1000),
        text: `segment ${lastIdx}`,
        segmentIndices: [lastIdx],
      },
    ]
    const result = expandContextWindows(segments, matches)
    expect(result).toHaveLength(1)
    expect(result[0].endIdx).toBe(lastIdx)
    // no error thrown
  })

  it('startMs and endMs are derived from offset (not NaN)', () => {
    const segments: TranscriptSegment[] = [
      { text: 'a', offset: 10.5, duration: 2.3, lang: 'en' },
      { text: 'b', offset: 12.8, duration: 3.1, lang: 'en' },
      { text: 'c', offset: 15.9, duration: 4.0, lang: 'en' },
    ]
    const matches: ClipMatch[] = [
      { startMs: 12800, endMs: 15900, text: 'b', segmentIndices: [1] },
    ]
    const result = expandContextWindows(segments, matches)
    expect(result[0].startMs).not.toBeNaN()
    expect(result[0].endMs).not.toBeNaN()
    // startMs from leftmost segment offset
    expect(result[0].startMs).toBe(Math.round(segments[result[0].startIdx].offset * 1000))
  })

  it('skips ClipMatch with empty segmentIndices without throwing (CR-01)', () => {
    const segments: TranscriptSegment[] = [{ text: 'a', offset: 0, duration: 5, lang: 'en' }]
    const matches: ClipMatch[] = [{ startMs: 0, endMs: 5000, text: 'a', segmentIndices: [] }]
    expect(() => expandContextWindows(segments, matches)).not.toThrow()
    expect(expandContextWindows(segments, matches)).toEqual([])
  })

  it('returns empty array when segments is empty but matches are non-empty (CR-02)', () => {
    const segments: TranscriptSegment[] = []
    const matches: ClipMatch[] = [{ startMs: 0, endMs: 5000, text: 'a', segmentIndices: [0] }]
    expect(() => expandContextWindows(segments, matches)).not.toThrow()
    expect(expandContextWindows(segments, matches)).toEqual([])
  })
})

describe('mergeOverlappingWindows', () => {
  it('returns empty array for empty input', () => {
    expect(mergeOverlappingWindows([])).toEqual([])
  })

  it('returns single window unchanged', () => {
    const windows = [{ startIdx: 2, endIdx: 5, startMs: 10000, endMs: 25000 }]
    const result = mergeOverlappingWindows(windows)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(windows[0])
  })

  it('keeps non-overlapping windows separate', () => {
    const windows = [
      { startIdx: 0, endIdx: 3, startMs: 0, endMs: 15000 },
      { startIdx: 8, endIdx: 12, startMs: 40000, endMs: 60000 },
    ]
    const result = mergeOverlappingWindows(windows)
    expect(result).toHaveLength(2)
    expect(result[0].startMs).toBe(0)
    expect(result[1].startMs).toBe(40000)
  })

  it('merges two overlapping windows (endMs >= next.startMs)', () => {
    const windows = [
      { startIdx: 0, endIdx: 5, startMs: 0, endMs: 25000 },
      { startIdx: 4, endIdx: 9, startMs: 20000, endMs: 45000 }, // overlaps: 20000 <= 25000
    ]
    const result = mergeOverlappingWindows(windows)
    expect(result).toHaveLength(1)
    expect(result[0].startMs).toBe(0)
    expect(result[0].endMs).toBe(45000)
    expect(result[0].startIdx).toBe(0)
    expect(result[0].endIdx).toBe(9)
  })

  it('merges two adjacent windows (currStartMs === lastEndMs)', () => {
    // Adjacent: window A endMs === window B startMs
    const windows = [
      { startIdx: 0, endIdx: 5, startMs: 0, endMs: 30000 },
      { startIdx: 5, endIdx: 10, startMs: 30000, endMs: 60000 }, // adjacent: 30000 <= 30000
    ]
    const result = mergeOverlappingWindows(windows)
    expect(result).toHaveLength(1)
    expect(result[0].startMs).toBe(0)
    expect(result[0].endMs).toBe(60000)
    expect(result[0].startIdx).toBe(0)
    expect(result[0].endIdx).toBe(10)
  })

  it('handles unsorted input — sorts by startMs before merging', () => {
    const windows = [
      { startIdx: 8, endIdx: 12, startMs: 40000, endMs: 60000 },
      { startIdx: 0, endIdx: 3, startMs: 0, endMs: 15000 },
    ]
    const result = mergeOverlappingWindows(windows)
    expect(result).toHaveLength(2)
    expect(result[0].startMs).toBe(0)
    expect(result[1].startMs).toBe(40000)
  })
})
