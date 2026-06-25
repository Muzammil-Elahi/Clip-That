/**
 * Runtime shape validation for stitchedTranscript JSON from Prisma.
 *
 * Prisma types the column as Json | null, so at runtime it can be any JSON
 * value. This utility validates the expected shape before casting to avoid
 * TypeError crashes in the render path (WR-01).
 */
import type { StitchedTranscriptEntry } from '@/types/job'

/**
 * Validates and returns a StitchedTranscriptEntry array from an unknown value,
 * or null if the value is absent or not the expected shape.
 * Entries that fail the shape check are filtered out rather than crashing.
 */
export function parseStitchedTranscript(raw: unknown): StitchedTranscriptEntry[] | null {
  if (raw === null || raw === undefined) return null
  if (!Array.isArray(raw)) return null
  const validated = raw.filter(
    (e): e is StitchedTranscriptEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as Record<string, unknown>).sourceStartMs === 'number' &&
      typeof (e as Record<string, unknown>).sourceEndMs === 'number' &&
      typeof (e as Record<string, unknown>).text === 'string',
  )
  // Return null (not empty array) if raw was non-empty but all entries were malformed
  if (raw.length > 0 && validated.length === 0) return null
  return validated
}
