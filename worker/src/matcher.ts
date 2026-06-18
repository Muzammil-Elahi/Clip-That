/**
 * Transcript normalization and exact topic matching utilities for Phase 2.
 * Pure utility module — no side effects, no I/O.
 */

import type { TranscriptSegment, ClipMatch } from './types.js'

/**
 * Normalizes text for exact phrase matching.
 * Per D-06: strips punctuation, normalizes whitespace, lowercases.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Finds all exact topic matches in transcript segments.
 * Implements D-07 (adjacent phrase matching) and D-08 (cross-segment check).
 *
 * Returns an empty array when no matches found — a no-match result means
 * DONE with empty clipPlan, not FAILED.
 */
export function findMatches(segments: TranscriptSegment[], topic: string): ClipMatch[] {
  const normTopic = normalize(topic)
  const matches: ClipMatch[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const normSeg = normalize(seg.text)

    // D-07: single-segment check
    if (normSeg.includes(normTopic)) {
      matches.push({
        startMs: Math.round(seg.offset * 1000),
        endMs: Math.round((seg.offset + seg.duration) * 1000),
        text: seg.text,
        segmentIndices: [i],
      })
      continue
    }

    // D-08: cross-boundary check — concatenate with next segment
    if (i + 1 < segments.length) {
      const nextSeg = segments[i + 1]
      const combined = normalize(seg.text + ' ' + nextSeg.text)
      if (combined.includes(normTopic)) {
        matches.push({
          startMs: Math.round(seg.offset * 1000),
          endMs: Math.round((nextSeg.offset + nextSeg.duration) * 1000),
          text: seg.text + ' ' + nextSeg.text,
          segmentIndices: [i, i + 1],
        })
        i++ // skip the consumed next segment
      }
    }
  }

  return matches
}

/**
 * Convenience alias for findMatches.
 * Builds the clip plan array from transcript segments and a topic phrase.
 * Called by worker/src/index.ts processPendingJob().
 */
export function buildClipPlan(segments: TranscriptSegment[], topic: string): ClipMatch[] {
  return findMatches(segments, topic)
}
