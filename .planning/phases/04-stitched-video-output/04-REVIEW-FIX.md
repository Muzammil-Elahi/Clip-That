---
phase: 04-stitched-video-output
fixed_at: 2026-06-26T00:00:00Z
review_path: .planning/phases/04-stitched-video-output/04-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-06-26T00:00:00Z
**Source review:** .planning/phases/04-stitched-video-output/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (3 Critical, 4 Warning)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Storage deletion errors silently swallowed in `cleanupExpiredVideos` — DB nulled anyway

**Files modified:** `worker/src/videoCleanup.ts`
**Commit:** 5b6642a
**Applied fix:** Destructured the return value of `supabaseAdmin.storage.from(BUCKET).remove(storagePaths)` to capture `removeError`. If an error is present, logs it and returns early without nulling the DB fields so the cleanup will be retried on the next polling tick.

---

### CR-02: Realtime payload bypasses `parseStitchedTranscript` validation — crashes non-null assertion in render

**Files modified:** `src/components/status-view.tsx`
**Commit:** 084d177
**Applied fix:** Changed `setStitchedTranscript(payload.new.stitchedTranscript ?? null)` to `setStitchedTranscript(parseStitchedTranscript(payload.new.stitchedTranscript))` in the Realtime callback (line 109). The Realtime path now applies the same JSON validation as the polling fallback, returning `null` for malformed payloads instead of passing through potentially non-array values that crash `.map` downstream.

---

### CR-03: `supabaseAdmin` constructed silently with `undefined` credentials at module load

**Files modified:** `worker/src/storageUploader.ts`
**Commit:** 8c81c39
**Applied fix:** Added an explicit startup guard before `createClient`: if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are falsy, logs a clear error message and calls `process.exit(1)`. The `createClient` call now uses the validated env vars directly (no `!` assertions). This matches the pattern already used for `WORKER_DATABASE_URL` in `index.ts`.

---

### WR-01: `mapVideoError` exposes raw internal error messages to end users

**Files modified:** `worker/src/videoDownloader.ts`
**Commit:** 1df170d
**Applied fix:** Replaced the `return err.message` passthrough with a pattern-matching classifier: FFmpeg errors, ENOENT/file-not-found errors, and HTTP status code errors each get distinct plain-language strings. Any unrecognised error falls through to the generic `'Video processing failed. Please try again.'` fallback. Follows the D-11 convention (single sentence, period at end, no jargon).

---

### WR-02: Video tab "No clips found" condition conflates `null` with empty array

**Files modified:** `src/components/status-view.tsx`
**Commit:** 5822596
**Applied fix:** Changed the condition from `!videoUrl && (stitchedTranscript?.length ?? 0) === 0` to `!videoUrl && Array.isArray(stitchedTranscript) && stitchedTranscript.length === 0`. The "No clips found" message now only renders when `stitchedTranscript` is a confirmed empty array, not when it is `null` (which could indicate loading, a parse error, or a timing race).

---

### WR-03: `stitchSegments` called with empty array is not guarded — FFmpeg concat demuxer fails on empty filelist

**Files modified:** `worker/src/videoStitcher.ts`
**Commit:** 4e59d6f
**Applied fix:** Added an early-return guard at the top of `stitchSegments`: if `segmentPaths.length === 0`, throws `new Error('stitchSegments: segmentPaths must not be empty')`. This protects future callers and refactors that bypass the `mergedWindows.length > 0` guard in `index.ts`.

---

### WR-04: FFmpeg `-ss` before `-i` causes seek-precision issues with `-c copy`; may produce segments with wrong start time

**Files modified:** `worker/src/videoExtractor.ts`
**Commit:** 21c895e
**Applied fix:** Moved `-ss` and `-to` flags to after `-i` (post-input seek). Pre-input fast seek snaps to the nearest keyframe, which can introduce several seconds of unintended leading content per clip. Post-input seek decodes to the exact timestamp at the cost of slightly more CPU. Also removed `-avoid_negative_ts make_zero` (unnecessary with post-input seek) and updated the JSDoc to document the trade-off.
**Status:** fixed: requires human verification — the change affects FFmpeg invocation behaviour; functional correctness depends on the actual keyframe distribution of processed videos, which requires runtime testing to confirm.

---

_Fixed: 2026-06-26T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
