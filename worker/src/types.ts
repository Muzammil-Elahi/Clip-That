/**
 * Worker-local type definitions. Mirror src/types/job.ts — keep in sync.
 */

/**
 * A single timestamped caption segment returned by youtube-transcript-plus.
 * Note: offset is seconds from video start — NOT 'start'.
 */
export interface TranscriptSegment {
  text: string
  offset: number   // seconds from video start — NOT 'start'
  duration: number // seconds
  lang: string
}

/**
 * A single topic match within the transcript, with source timestamps for Phase 3.
 * Note: startMs = Math.round(offset * 1000); Phase 3 uses segmentIndices for context expansion.
 */
export interface ClipMatch {
  startMs: number          // Math.round(segment.offset * 1000)
  endMs: number            // Math.round((segment.offset + segment.duration) * 1000)
  text: string             // raw transcript text of matched segment(s)
  segmentIndices: number[] // indices into transcript array (for Phase 3)
}

/**
 * A single entry in the stitched transcript, with source video timestamps.
 * Produced by buildStitchedTranscript() from ExpandedWindow[] in Phase 3.
 */
export interface StitchedTranscriptEntry {
  sourceStartMs: number  // Math.round(segment.offset * 1000)
  sourceEndMs: number    // Math.round((segment.offset + segment.duration) * 1000)
  text: string
}
