/**
 * Context window expansion and overlap merging utilities for Phase 3.
 * Pure utility module — no side effects, no I/O.
 */

import type { TranscriptSegment, ClipMatch } from './types.js'

/** Default context window size: 30 seconds in milliseconds. */
export const CONTEXT_WINDOW_MS = 30_000

/**
 * A context-expanded window derived from a ClipMatch.
 * startIdx and endIdx are indices into the TranscriptSegment array.
 */
export interface ExpandedWindow {
  startIdx: number  // index into TranscriptSegment[]
  endIdx: number    // index into TranscriptSegment[]
  startMs: number   // Math.round(segments[startIdx].offset * 1000)
  endMs: number     // Math.round((segments[endIdx].offset + segments[endIdx].duration) * 1000)
}

/**
 * Expands each ClipMatch into a context window by walking outward through
 * transcript segment indices until cumulative duration >= contextMs in each direction.
 * Implements CLP-02 (D-01): segment-boundary snapping, edge truncation (D-02).
 */
export function expandContextWindows(
  segments: TranscriptSegment[],
  matches: ClipMatch[],
  contextMs = CONTEXT_WINDOW_MS,
): ExpandedWindow[] {
  return matches.map(match => {
    const innerStart = Math.min(...match.segmentIndices)
    const innerEnd   = Math.max(...match.segmentIndices)

    // Walk left until >= contextMs accumulated or start of array
    let leftIdx = innerStart
    let leftMs = 0
    while (leftIdx > 0 && leftMs < contextMs) {
      leftIdx--
      leftMs += Math.round(segments[leftIdx].duration * 1000)
    }

    // Walk right until >= contextMs accumulated or end of array
    let rightIdx = innerEnd
    let rightMs = 0
    while (rightIdx < segments.length - 1 && rightMs < contextMs) {
      rightIdx++
      rightMs += Math.round(segments[rightIdx].duration * 1000)
    }

    return {
      startIdx: leftIdx,
      endIdx: rightIdx,
      startMs: Math.round(segments[leftIdx].offset * 1000),
      endMs: Math.round((segments[rightIdx].offset + segments[rightIdx].duration) * 1000),
    }
  })
}

/**
 * Merges overlapping or adjacent ExpandedWindows into non-overlapping spans.
 * Implements CLP-03: sort by startMs, then merge when curr.startMs <= last.endMs.
 */
export function mergeOverlappingWindows(windows: ExpandedWindow[]): ExpandedWindow[] {
  if (windows.length === 0) return []

  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs)
  const merged: ExpandedWindow[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const curr = sorted[i]

    if (curr.startMs <= last.endMs) {
      // Overlapping or adjacent — extend the last window
      merged[merged.length - 1] = {
        startIdx: last.startIdx,
        endIdx: Math.max(last.endIdx, curr.endIdx),
        startMs: last.startMs,
        endMs: Math.max(last.endMs, curr.endMs),
      }
    } else {
      merged.push(curr)
    }
  }

  return merged
}
