---
phase: "04-stitched-video-output"
plan: "01"
subsystem: "worker"
tags: ["video-pipeline", "ffmpeg", "youtube-download", "supabase-storage", "cleanup"]
dependency_graph:
  requires:
    - "03-context-clip-plan-and-stitched-transcript (mergedWindows from Phase 3)"
  provides:
    - "videoUrl String? on Job row (Supabase Storage signed URL)"
    - "videoExpiresAt DateTime? on Job row (cleanup window)"
    - "cleanupExpiredVideos() called every polling tick"
  affects:
    - "04-02 (frontend reads videoUrl from Job row via Realtime)"
tech_stack:
  added:
    - "ffmpeg-static@5.3.0 — pre-built FFmpeg binary, no Railway system config needed"
    - "@distube/ytdl-core@4.16.12 — YouTube video stream download (archived Aug 2025, D-02)"
    - "@supabase/supabase-js@^2.108.1 — installed in worker for Storage upload + signed URL"
    - "@types/ffmpeg-static — TypeScript types for ffmpeg-static"
  patterns:
    - "direct child_process.spawn for FFmpeg (no fluent-ffmpeg — deprecated)"
    - "node:stream/promises pipeline() for YouTube stream-to-file download"
    - "FFmpeg concat demuxer (-f concat -safe 0 -c copy) for segment stitching"
    - "withTempDir<T> try/finally cleanup pattern"
    - "Supabase Storage admin client (service role key) for worker-side uploads"
    - "vi.mock hoisting pattern for module-level singleton clients (supabaseAdmin)"
key_files:
  created:
    - "worker/src/videoDownloader.ts — downloadYouTubeVideo, mapVideoError"
    - "worker/src/videoExtractor.ts — runFfmpeg, extractSegments, ffmpegPath null guard"
    - "worker/src/videoStitcher.ts — stitchSegments (imports runFfmpeg from videoExtractor)"
    - "worker/src/storageUploader.ts — uploadVideoAndGetUrl, supabaseAdmin, BUCKET, RETENTION_MS"
    - "worker/src/videoCleanup.ts — cleanupExpiredVideos, CLEANUP_BATCH_LIMIT=10"
    - "worker/src/__tests__/videoDownloader.test.ts"
    - "worker/src/__tests__/videoExtractor.test.ts"
    - "worker/src/__tests__/videoStitcher.test.ts"
    - "worker/src/__tests__/storageUploader.test.ts"
    - "worker/src/__tests__/videoCleanup.test.ts"
  modified:
    - "prisma/schema.prisma — Job model gains videoUrl String? and videoExpiresAt DateTime?"
    - "worker/src/index.ts — withTempDir helper, Phase 4 pipeline, cleanupExpiredVideos in main()"
    - "worker/package.json — new dependencies added"
decisions:
  - "Used ffmpeg-static + direct child_process.spawn (no fluent-ffmpeg — deprecated per RESEARCH.md)"
  - "supabaseAdmin created at module load time; tests use vi.mock factory + mockImplementation in beforeEach"
  - "Video pipeline skipped (videoUrl=null) when mergedWindows is empty (no topic matches)"
  - "Error mapping: mapTranscriptError() takes precedence over mapVideoError() for transcript errors"
  - "Prisma schema pushed via 'npx prisma db push' from project root using prisma.config.ts"
  - "@supabase/supabase-js installed in worker (was only in main Next.js app before)"
metrics:
  duration: "9 minutes"
  completed_date: "2026-06-26"
  tasks_completed: 2
  files_created: 12
  files_modified: 3
  tests_total: 57
  tests_added: 17
---

# Phase 04 Plan 01: Worker Video Pipeline Summary

**One-liner:** FFmpeg video extraction and stitching pipeline using ffmpeg-static + @distube/ytdl-core with Supabase Storage upload, signed URL persistence, and per-tick artifact cleanup.

## What Was Built

Five new worker modules implement the server-side video pipeline that runs after `buildStitchedTranscript()` in each job:

1. **videoDownloader.ts** — Downloads the YouTube source video to a temp file using `@distube/ytdl-core` and `node:stream/promises` pipeline. Filters for combined mp4 format (video + audio).

2. **videoExtractor.ts** — Runs FFmpeg via `child_process.spawn` to extract each `ExpandedWindow` as a segment file using `-ss`/`-to` with `-c copy` (no re-encode). Includes a module-level `ffmpegPath` null guard (RESEARCH.md Pitfall 2). Exports `runFfmpeg` for use by videoStitcher.

3. **videoStitcher.ts** — Writes `filelist.txt` and runs FFmpeg's concat demuxer (`-f concat -safe 0 -c copy`) to stitch all segments into `output.mp4` without re-encoding.

4. **storageUploader.ts** — Uploads the stitched mp4 to Supabase Storage bucket `clip-videos` using a service role admin client. Returns a 24-hour signed URL. Exports `supabaseAdmin`, `BUCKET`, and `RETENTION_MS` constants.

5. **videoCleanup.ts** — On each polling tick, queries for jobs with `videoExpiresAt < now && videoUrl != null`, deletes their Storage files in batches of 10, and nulls `videoUrl`/`videoExpiresAt` on the Job row.

**Schema:** `videoUrl String?` and `videoExpiresAt DateTime?` added to Job model, pushed to database.

**index.ts:** `withTempDir<T>` helper added; `processPendingJob()` runs the full pipeline in a finally-guarded temp dir; `main()` loop calls `cleanupExpiredVideos(prisma)` before `processPendingJob()`.

## Test Results

- 9 test files, 57 tests — all pass
- 17 new tests cover all five new modules
- TDD gate: RED commit `b39fe9a` (5 test files, import errors), GREEN commit `2312875` (all modules implemented, all 57 pass)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest mock hoisting broke storageUploader.test.ts and videoCleanup.test.ts**
- **Found during:** Task 2 first test run
- **Issue:** `storageUploader.ts` creates `supabaseAdmin = createClient(...)` at module load time. Test variables declared at module scope can't be referenced inside `vi.mock` factories because Vitest hoists `vi.mock` calls before variable initializers run (`ReferenceError: Cannot access 'mockFrom' before initialization`).
- **Fix:** Rewrote both test files to keep mock factories self-contained with inline `vi.fn()` values; used `mockImplementation` in `beforeEach` to update the already-created client's storage methods.
- **Files modified:** `worker/src/__tests__/storageUploader.test.ts`, `worker/src/__tests__/videoCleanup.test.ts`
- **Commit:** 2312875

**2. [Rule 3 - Blocking] @supabase/supabase-js not installed in worker**
- **Found during:** Task 1 package install
- **Issue:** `@supabase/supabase-js` was only in the root Next.js `node_modules`, not in `worker/node_modules`. `storageUploader.ts` imports it directly.
- **Fix:** Ran `npm install @supabase/supabase-js@^2.108.1` from the `worker/` directory.
- **Files modified:** `worker/package.json`, `worker/package-lock.json`
- **Commit:** b39fe9a

**3. [Rule 2 - Guard] Empty mergedWindows guard in processPendingJob**
- **Found during:** Task 2 implementation review
- **Issue:** If `mergedWindows.length === 0` (no topic matches), the video pipeline would try to download and extract zero segments, resulting in an empty filelist and a likely FFmpeg error.
- **Fix:** Added `if (mergedWindows.length > 0)` guard around the `withTempDir` block; `videoUrl` stays `null` for no-match jobs. `videoExpiresAt` is also set to null in that case.
- **Files modified:** `worker/src/index.ts`
- **Commit:** 2312875

**4. [Rule 2 - Security] Error message priority for dual-error-mapper pattern**
- **Found during:** Task 2 implementation
- **Issue:** Plan said "replace or extend mapTranscriptError call so video pipeline errors also map to user-friendly messages" but a naive `mapVideoError(err) || mapTranscriptError(err)` would shadow transcript-specific messages (YoutubeTranscriptNotAvailableError etc.) with their raw `.message`.
- **Fix:** Check `mapTranscriptError()` first; if it returns its generic fallback (no instanceof match), fall back to `mapVideoError()`. Preserves Phase 2's user-facing transcript error messages while handling new video pipeline errors.
- **Files modified:** `worker/src/index.ts`
- **Commit:** 2312875

**5. [Rule 3 - Blocking] Prisma db push requires project root (not worker directory)**
- **Found during:** Task 1 schema push
- **Issue:** Plan said `cd worker && npx prisma db push --schema=../prisma/schema.prisma` but the worker directory has no `prisma.config.ts` with a `datasource.url`. Push must run from project root where `prisma.config.ts` uses `DIRECT_URL` from `.env.local`.
- **Fix:** Ran `npx prisma db push` from project root; schema pushed successfully.
- **Commit:** b39fe9a

## Manual Setup Required Before This Phase Ships

The following must be done manually in the Supabase dashboard before any job runs:

1. **Create Supabase Storage bucket `clip-videos`** as a private bucket (no public access). First upload will fail with "Bucket not found" without this step.
2. **Add `SUPABASE_SERVICE_ROLE_KEY` to `worker/.env.local`** and Railway environment variables. Required for storage upload; missing key causes RLS permission errors.
3. **Confirm `SUPABASE_URL` is in worker environment** (may already be set; check worker `.env.local`).
4. **Configure CORS on `clip-videos` bucket** to allow the app's origin for `<video>` playback (RESEARCH.md Open Question 1, resolved as manual setup).

## Threat Surface

No new threat surface beyond what the PLAN.md threat model covers (T-04-01 through T-04-06). All mitigations implemented:
- `SUPABASE_SERVICE_ROLE_KEY` is worker-only (T-04-03, T-04-06)
- Storage path is `jobs/{UUID}/output.mp4` with no user-controlled components (T-04-02)
- `youtubeUrl` validated by `extractYouTubeVideoId()` before reaching the downloader (T-04-01)
- Signed URL stored on RLS-protected Job row (T-04-04)

## Known Stubs

None. The Phase 4-01 pipeline is fully wired end-to-end on the worker side. The `videoUrl` field on the Job row is ready for Phase 4-02 to surface to the browser via Realtime.

## Self-Check: PASSED
