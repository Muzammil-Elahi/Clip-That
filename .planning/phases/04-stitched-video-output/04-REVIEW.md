---
phase: 04-stitched-video-output
reviewed: 2026-06-25T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - prisma/schema.prisma
  - src/__tests__/status-view-video-tab.test.tsx
  - src/__tests__/status-view.test.tsx
  - src/app/status/page.tsx
  - src/components/status-view.tsx
  - src/types/job.ts
  - worker/package.json
  - worker/src/__tests__/storageUploader.test.ts
  - worker/src/__tests__/videoCleanup.test.ts
  - worker/src/__tests__/videoDownloader.test.ts
  - worker/src/__tests__/videoExtractor.test.ts
  - worker/src/__tests__/videoStitcher.test.ts
  - worker/src/index.ts
  - worker/src/storageUploader.ts
  - worker/src/videoCleanup.ts
  - worker/src/videoDownloader.ts
  - worker/src/videoExtractor.ts
  - worker/src/videoStitcher.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-06-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This phase adds a worker video pipeline (download, extract segments, stitch, upload to Supabase Storage) and a Video tab to the client status view. The overall structure is sound — temp directory management is correct, the Prisma schema additions are consistent with the client types, and the FFmpeg invocation patterns are reasonable. However, three issues cross the BLOCKER threshold: the cleanup function silently eats storage deletion errors and then marks the DB records as cleaned-up regardless, the Realtime handler bypasses the same JSON validation that the polling fallback applies (creating a crash path via a non-null assertion downstream), and the `supabaseAdmin` client is silently constructed with `undefined` credentials when the required env vars are absent.

---

## Critical Issues

### CR-01: Storage deletion errors silently swallowed in `cleanupExpiredVideos` — DB nulled anyway

**File:** `worker/src/videoCleanup.ts:25`

**Issue:** `supabaseAdmin.storage.from(BUCKET).remove(storagePaths)` is called but its return value is never inspected for errors. On any storage failure (network error, bucket policy, object not found) the code proceeds unconditionally to `prisma.job.updateMany(...)` and nulls out `videoUrl` / `videoExpiresAt`. The orphaned storage objects will never be retried — they accumulate in the bucket indefinitely without any visibility.

**Fix:**
```typescript
const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove(storagePaths)
if (removeError) {
  // Log and bail — do NOT null the DB fields; retry next tick
  console.error('cleanupExpiredVideos: storage remove failed:', removeError)
  return
}

await prisma.job.updateMany({
  where: { id: { in: expired.map((j) => j.id) } },
  data: { videoUrl: null, videoExpiresAt: null },
})
```

---

### CR-02: Realtime payload bypasses `parseStitchedTranscript` validation — crashes non-null assertion in render

**File:** `worker/src/index.ts` (data origin), `src/components/status-view.tsx:109` (consumer)

**Issue:** In the Realtime subscription callback, `stitchedTranscript` is set directly from the raw Supabase payload:

```typescript
setStitchedTranscript(payload.new.stitchedTranscript ?? null)
```

The polling fallback at line 140 correctly calls `parseStitchedTranscript(row.stitchedTranscript)`. The Realtime path does not. Downstream at line 261 the code uses `stitchedTranscript!.map(...)` — a non-null assertion. If the Realtime payload contains a malformed `stitchedTranscript` value (e.g. a plain object instead of an array, or an array with entries missing required fields), `parseStitchedTranscript` would have returned `null` and the component would render the empty-state message. Without the call, the value passes through as an array-like with malformed entries, and `entry.sourceStartMs` in `formatTimestamp` receives `undefined`, causing `formatTimestamp` to output `[NaN:NaN]`. More critically, if the value is not an array at all, `.map` throws at runtime, crashing the component tree.

**Fix:**
```typescript
// line 109 in the Realtime callback:
setStitchedTranscript(parseStitchedTranscript(payload.new.stitchedTranscript))
```

---

### CR-03: `supabaseAdmin` constructed silently with `undefined` credentials at module load

**File:** `worker/src/storageUploader.ts:25-28`

**Issue:** `supabaseAdmin` is created at module import time using `process.env.SUPABASE_URL!` and `process.env.SUPABASE_SERVICE_ROLE_KEY!`. The non-null assertions (`!`) suppress TypeScript's warning but do not cause a runtime error when the env vars are missing — `createClient(undefined, undefined)` succeeds and returns a client that will silently fail on all subsequent requests (returning auth/network errors rather than crashing at startup). The worker's `index.ts` explicitly guards the database URL and calls `process.exit(1)` if missing; no equivalent guard exists for the Supabase credentials. A misconfigured deployment will process jobs up to the upload step and then fail with a cryptic Supabase client error, leaving jobs marked FAILED with an opaque message.

**Fix:** Add a startup guard before the `createClient` call, matching the pattern in `index.ts`:
```typescript
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set — cannot initialise storage client')
  process.exit(1)
}

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
```

---

## Warnings

### WR-01: `mapVideoError` exposes raw internal error messages to end users

**File:** `worker/src/videoDownloader.ts:26-31`

**Issue:** `mapVideoError` returns `err.message` verbatim for any `Error` instance. In `index.ts` at line 134-136, this is used as the fallback when `mapTranscriptError` returns its generic string. As a result, technical messages like `"FFmpeg exited 1: [verbose stderr output]"` or `"ENOENT: no such file or directory, open '/tmp/...'"` are stored in `job.errorMessage` and rendered directly to users in the `AlertDescription`. This violates the plain-language D-11 convention established in Phase 1.

**Fix:**
```typescript
export function mapVideoError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('ffmpeg')) return 'Video processing failed. Please try again.'
    if (msg.includes('enoent') || msg.includes('no such file')) return 'Video processing failed. Please try again.'
    if (msg.includes('status code') || msg.includes('403') || msg.includes('410')) {
      return 'This video could not be downloaded. It may be private or region-restricted.'
    }
  }
  return 'Video processing failed. Please try again.'
}
```

---

### WR-02: Video tab "No clips found" condition conflates `null` with empty array

**File:** `src/components/status-view.tsx:238`

**Issue:** The condition for showing "No clips found" is:
```typescript
!videoUrl && (stitchedTranscript?.length ?? 0) === 0
```

`stitchedTranscript` can be `null` (not yet loaded / malformed) or `[]` (empty array, genuine no-results). Both evaluate to `(?.length ?? 0) === 0`. When the Realtime event fires with `videoUrl` set but `stitchedTranscript` still `null` (timing race where only `videoUrl` updates), the Video tab correctly shows the `<video>` element. However if the job's `stitchedTranscript` was `null` and `videoUrl` is also `null` (e.g. `parseStitchedTranscript` returned `null` for a malformed payload), the user sees "No clips found" even though the job may still be processing or the data is corrupted rather than genuinely empty. The empty state message is displayed with no way to distinguish these cases.

**Fix:** The component should distinguish between `null` (unknown/error) and `[]` (confirmed empty). Use `Array.isArray(stitchedTranscript) && stitchedTranscript.length === 0` for the true empty state:
```typescript
{!videoUrl && Array.isArray(stitchedTranscript) && stitchedTranscript.length === 0 ? (
  <p className="text-base text-muted-foreground">
    No clips found for &quot;{topic}&quot;.
  </p>
) : videoUrl ? (
  <video controls src={videoUrl} className="w-full rounded-md" />
) : (
  <p className="text-base text-muted-foreground">Working on it...</p>
)}
```

---

### WR-03: `stitchSegments` called with empty array is not guarded — FFmpeg concat demuxer fails on empty filelist

**File:** `worker/src/videoStitcher.ts:10-31`

**Issue:** `stitchSegments` accepts `segmentPaths: string[]` and writes a filelist then calls FFmpeg unconditionally. If `segmentPaths` is empty (which can happen if `extractSegments` returns `[]` because `windows` was empty), `filelist.txt` will be empty and FFmpeg's concat demuxer will exit non-zero with `"concat: No files to read"`. The caller in `index.ts` at line 98 guards `mergedWindows.length > 0` before entering the video pipeline, so the empty-array case does not currently reach `stitchSegments`. However the function itself has no guard, so future callers or refactors could hit this silently.

**Fix:** Add a guard at the top of `stitchSegments`:
```typescript
export async function stitchSegments(
  segmentPaths: string[],
  outputPath: string,
): Promise<void> {
  if (segmentPaths.length === 0) {
    throw new Error('stitchSegments: segmentPaths must not be empty')
  }
  // ... rest of function
}
```

---

### WR-04: FFmpeg `-ss` before `-i` causes seek-precision issues with `-c copy`; may produce segments with wrong start time

**File:** `worker/src/videoExtractor.ts:49-57`

**Issue:** The FFmpeg invocation places `-ss` (seek) before `-i` (input), which is the fast-seek mode. Combined with `-c copy` (stream copy, no re-encode), fast pre-input seek snaps to the nearest keyframe. For segments that start between keyframes, the actual extracted segment will start at the nearest preceding keyframe — which may be several seconds before `startMs`. The segment file's timeline will be correct (it covers the right content), but the `-avoid_negative_ts make_zero` flag only normalises timestamps relative to the output stream start — it does not compensate for the extra leading content introduced by keyframe snapping. The stitched video will contain unintended leading frames at the start of each clip.

**Fix:** Move `-ss`/`-to` to after `-i` for frame-accurate cutting (at the cost of decoding up to the cut point), or accept keyframe-snapped extraction and document the behaviour. If fast extraction is required, use `-ss` before `-i` with `-copyts` and no `-avoid_negative_ts` so callers know the behaviour:
```
// Frame-accurate (re-encode not required — only cuts differ):
'-i', sourceFile,
'-ss', startSec,
'-to', endSec,
'-c', 'copy',
'-y',
outputFile,
```
Note: the trade-off (slower but frame-accurate) should be documented in the function's JSDoc.

---

## Info

### IN-01: Dead mock variables in `storageUploader.test.ts`

**File:** `worker/src/__tests__/storageUploader.test.ts:7-17`

**Issue:** `mockUpload`, `mockCreateSignedUrl`, `mockRemove`, and `mockFrom` are declared at module level but are never used. The `vi.mock` factory at line 24 defines its own local `upload`, `createSignedUrl`, and `from` variables inside the closure — these inner variables are what the mocked module uses. The module-level variables are dead code that adds confusion about which mock handles which call.

**Fix:** Remove lines 7-17 (the four `vi.fn()` declarations and `mockFrom`). They have no effect on test behaviour.

---

### IN-02: `process.on('SIGTERM')` handler in `index.ts` may miss in-flight temp directory cleanup

**File:** `worker/src/index.ts:61-66`

**Issue:** The SIGTERM handler waits for `processingJob` to go `false` and then disconnects Prisma. However, `processingJob` is set to `false` in the `finally` block of `processPendingJob` (line 143), which runs after `withTempDir` has already cleaned up the temp directory. The shutdown sequence is therefore safe — but only because `processingJob = false` is inside `finally`, not after `withTempDir` returns. If future refactoring moves `processingJob = false` to before `withTempDir`'s cleanup, the SIGTERM handler could disconnect Prisma while a temp directory still exists. This is a fragile ordering dependency with no comment.

**Fix:** Add a comment at the `processingJob = false` line noting the ordering dependency:
```typescript
} finally {
  // NOTE: do not move this before withTempDir — SIGTERM handler polls processingJob
  // to know when it's safe to exit; it must only become false after all cleanup is done.
  processingJob = false
}
```

---

_Reviewed: 2026-06-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
