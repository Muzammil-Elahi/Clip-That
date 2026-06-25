/**
 * Stitched transcript generation utilities for Phase 3.
 * Pure utility module — no side effects, no I/O.
 */

import type { TranscriptSegment, StitchedTranscriptEntry } from './types.js'
import type { ExpandedWindow } from './contextExpander.js'

/**
 * Builds a StitchedTranscriptEntry array from merged context windows.
 * Implements STR-01 (D-03, D-05): maps each segment in each merged window to
 * { sourceStartMs, sourceEndMs, text }. No gap markers between non-adjacent windows.
 */
export function buildStitchedTranscript(
  segments: TranscriptSegment[],
  mergedWindows: ExpandedWindow[],
): StitchedTranscriptEntry[] {
  const entries: StitchedTranscriptEntry[] = []
  for (const span of mergedWindows) {
    for (let i = span.startIdx; i <= span.endIdx; i++) {
      const seg = segments[i]
      entries.push({
        sourceStartMs: Math.round(seg.offset * 1000),
        sourceEndMs: Math.round((seg.offset + seg.duration) * 1000),
        text: seg.text,
      })
    }
  }
  return entries
}
