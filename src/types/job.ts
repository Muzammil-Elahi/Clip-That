/**
 * Client-side JobStatus enum — mirrors the Prisma JobStatus enum for use in
 * browser components and Server Actions without importing from generated Prisma client.
 */
export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

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
  // Phase 6 additions — optional so exact-match code requires zero changes
  matchType?: 'exact' | 'semantic'
  confidence?: number // cosine similarity 0–1, 2 decimal places
}

/**
 * A single entry in the stitched transcript, with source video timestamps.
 * Mirror of worker/src/types.ts StitchedTranscriptEntry — keep in sync.
 */
export interface StitchedTranscriptEntry {
  sourceStartMs: number
  sourceEndMs: number
  text: string
}

/**
 * Client-side Job type — mirrors the Prisma Job model shape for use in
 * components and Server Actions. Timestamps serialised as ISO strings.
 */
export interface Job {
  id: string
  userId: string
  youtubeUrl: string
  topic: string
  status: JobStatus
  errorMessage: string | null
  transcript: TranscriptSegment[] | null
  clipPlan: ClipMatch[] | null
  stitchedTranscript: StitchedTranscriptEntry[] | null  // Phase 3
  videoUrl:           string | null                      // Phase 4: Supabase Storage signed URL
  videoExpiresAt:     string | null                      // Phase 4: ISO string, DateTime serialised
  studyNotes:         string | null                      // Phase 5: AI-generated Markdown study notes
  semanticEnabled:    boolean                            // Phase 6: user opted into semantic matching
  semanticFailed:     boolean                            // Phase 6: true when semantic matching errored
  createdAt: string
  updatedAt: string
}
