import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

/** Supabase Storage bucket name for stitched video files. */
export const BUCKET = 'clip-videos'

/**
 * Retention window in milliseconds (24 hours).
 * Used to set videoExpiresAt on the Job row at completion.
 * Per D-07: 24h default retention.
 */
export const RETENTION_MS = 24 * 60 * 60 * 1000

/**
 * Retention window in seconds for Supabase createSignedUrl().
 * Must match RETENTION_MS to avoid signed URL / cleanup timing mismatch (RESEARCH.md Pitfall 6).
 */
const RETENTION_S = RETENTION_MS / 1000

/**
 * Supabase admin client using service role key.
 * Bypasses RLS for worker-side Storage uploads.
 * Per D-04, T-04-06: NEVER expose SUPABASE_SERVICE_ROLE_KEY to browser or NEXT_PUBLIC_ vars.
 */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * Uploads a stitched video file to Supabase Storage and returns a signed URL.
 * Storage path: jobs/{jobId}/output.mp4 — jobId is a Prisma UUID, no user input in path.
 * Per D-04, T-04-02 (path traversal impossible).
 */
export async function uploadVideoAndGetUrl(
  filePath: string,
  jobId: string,
): Promise<string> {
  const buffer = await readFile(filePath)
  const storagePath = `jobs/${jobId}/output.mp4`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'video/mp4',
      upsert: true,
    })
  if (uploadError) throw uploadError

  const { data, error: urlError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, RETENTION_S)
  if (urlError || !data) throw urlError ?? new Error('No signed URL returned')

  return data.signedUrl
}
