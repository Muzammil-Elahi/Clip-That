---
phase: 04-stitched-video-output
verified: 2026-06-25T23:05:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Submit a YouTube URL + topic; wait for DONE status; confirm Video tab shows <video> player (not placeholder text)"
    expected: "Video tab renders an HTML5 <video> element with native controls and the stitched clip plays"
    why_human: "Requires a live worker with Supabase Storage bucket configured and SUPABASE_SERVICE_ROLE_KEY set; cannot test programmatically"
  - test: "Confirm video plays after clicking (signed URL + CORS)"
    expected: "Browser successfully loads and plays the signed Supabase Storage URL; no CORS or media-src CSP error in console"
    why_human: "Requires live infrastructure: Supabase Storage bucket 'clip-videos' with CORS configured for the app origin (D-08 / RESEARCH.md Open Question 1)"
  - test: "Submit a URL for a video where the topic does not appear; confirm Video tab shows 'No clips found for <topic>' message"
    expected: "<TabsContent value='video'> renders the 'No clips found for ...' paragraph, not the <video> element"
    why_human: "Requires a live worker processing a no-match job end-to-end"
  - test: "Confirm Supabase Storage bucket 'clip-videos' exists as private"
    expected: "Bucket visible in Supabase Storage dashboard with 'Private' access control; no public URL access"
    why_human: "Dashboard check — cannot verify from codebase"
  - test: "Confirm SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL are set in worker environment"
    expected: "Both variables present in worker/.env.local and Railway environment variables"
    why_human: "Environment secrets — cannot verify from codebase"
  - test: "After 24h, verify signed URL is expired and worker cleanup has nulled videoUrl on the Job row"
    expected: "<video> shows browser error (expired URL); Supabase dashboard shows null videoUrl and null videoExpiresAt on the Job row"
    why_human: "Time-dependent behavior; requires waiting 24h and checking Supabase dashboard"
---

# Phase 04: Stitched Video Output — Verification Report

**Phase Goal:** As a student, I want to play a stitched video clip of my searched topic, so that I can review just the relevant moments without rewatching the full video.
**Verified:** 2026-06-25T23:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

The phase goal is achievable with this implementation. Every code path required to download a YouTube video, extract topic segments with FFmpeg, stitch them into one continuous mp4, upload to Supabase Storage, deliver a signed URL via Realtime and polling, and render a native HTML5 `<video>` player in the browser Video tab has been implemented and verified in the codebase. The goal cannot be declared fully achieved without human sign-off on six infrastructure prerequisites (bucket, CORS, env vars, live job run, signed URL expiry).

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Worker downloads YouTube source video to a job-scoped temp directory before FFmpeg runs | VERIFIED | `worker/src/videoDownloader.ts` exports `downloadYouTubeVideo`; called inside `withTempDir` in `index.ts:104` |
| 2 | Worker extracts each ExpandedWindow as a segment file using FFmpeg -ss/-to -c copy | VERIFIED | `worker/src/videoExtractor.ts:49-57` — runFfmpeg called with `-ss`, `-to`, `-i`, `-c copy`, `-avoid_negative_ts make_zero` |
| 3 | Worker stitches all segment files into output.mp4 using FFmpeg concat demuxer | VERIFIED | `worker/src/videoStitcher.ts:23-30` — runFfmpeg called with `-f concat -safe 0 -i filelist.txt -c copy` |
| 4 | Worker uploads output.mp4 to Supabase Storage bucket 'clip-videos' using service role key | VERIFIED | `worker/src/storageUploader.ts:42-48` — uploads to `jobs/${jobId}/output.mp4` using `supabaseAdmin` (service role); `BUCKET = 'clip-videos'` |
| 5 | Worker writes videoUrl (signed URL) and videoExpiresAt (now + 24h) to the Job row alongside status DONE | VERIFIED | `worker/src/index.ts:118-128` — `prisma.job.update` with `videoUrl`, `videoExpiresAt: new Date(Date.now() + RETENTION_MS)`, `status: 'DONE'` |
| 6 | Worker cleanup pass on each polling tick deletes expired storage files and nulls videoUrl/videoExpiresAt | VERIFIED | `worker/src/videoCleanup.ts:12-30`; called at `index.ts:153` before `processPendingJob()` each tick |
| 7 | Temp directory is always removed in a finally block regardless of success or failure | VERIFIED | `worker/src/index.ts:45-56` — `withTempDir` wraps `fn(tmpDir)` in `try { } finally { rm(tmpDir, { recursive: true, force: true }) }` |
| 8 | User sees a native HTML5 `<video>` player in the Video tab when videoUrl is set on a DONE job | VERIFIED | `src/components/status-view.tsx:243-248` — `<video controls src={videoUrl} className="w-full rounded-md" />` rendered when `videoUrl` is truthy |
| 9 | videoUrl flows from the Job row to the browser via Supabase Realtime and polling fallback | VERIFIED | Realtime: `status-view.tsx:110`; polling fallback: `status-view.tsx:131`; select: `'status, errorMessage, stitchedTranscript, videoUrl'` at line 130 |
| 10 | Status page server component passes initialVideoUrl to StatusView | VERIFIED | `src/app/status/page.tsx:64` — `initialVideoUrl={job.videoUrl ?? null}` |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `worker/src/videoDownloader.ts` | exports `downloadYouTubeVideo`, `mapVideoError` | VERIFIED | Both exports present; uses `@distube/ytdl-core` + `node:stream/promises` pipeline |
| `worker/src/videoExtractor.ts` | exports `runFfmpeg`, `extractSegments`; ffmpegPath null guard | VERIFIED | Null guard at lines 8-10; both functions exported |
| `worker/src/videoStitcher.ts` | exports `stitchSegments`; imports `runFfmpeg` from `./videoExtractor.js` | VERIFIED | Import at line 3; function exported |
| `worker/src/storageUploader.ts` | exports `uploadVideoAndGetUrl`, `supabaseAdmin`, `BUCKET`, `RETENTION_MS`; uses `SUPABASE_SERVICE_ROLE_KEY` | VERIFIED | All four exports present; `BUCKET='clip-videos'`, `RETENTION_MS=86400000` |
| `worker/src/videoCleanup.ts` | exports `cleanupExpiredVideos`; uses take: 10 batch limit | VERIFIED | `CLEANUP_BATCH_LIMIT = 10`; `take: CLEANUP_BATCH_LIMIT` in findMany query |
| `worker/src/index.ts` | withTempDir helper; full pipeline in processPendingJob; cleanupExpiredVideos in main() | VERIFIED | All three elements present and wired |
| `prisma/schema.prisma` | `videoUrl String?` and `videoExpiresAt DateTime?` in Job model | VERIFIED | Lines 28-29 in Job model |
| `src/types/job.ts` | Job interface with `videoUrl: string \| null` and `videoExpiresAt: string \| null` | VERIFIED | Lines 58-59 of Job interface |
| `src/components/status-view.tsx` | Video tab with conditional `<video>` player; three states | VERIFIED | Lines 237-253 implement all three states |
| `src/app/status/page.tsx` | `initialVideoUrl` prop passed to StatusView | VERIFIED | Line 64 |
| `src/__tests__/status-view-video-tab.test.tsx` | RTL tests for three Video tab states | VERIFIED | File exists; 3 tests pass |
| `worker/src/__tests__/video*.test.ts` | 5 unit test files for new worker modules | VERIFIED | All 5 files present; 17 tests pass |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `worker/src/index.ts processPendingJob()` | `videoDownloader.ts` | `downloadYouTubeVideo` called inside `withTempDir` | WIRED | `index.ts:17` import; `index.ts:104` call |
| `worker/src/index.ts processPendingJob()` | `storageUploader.ts` | `uploadVideoAndGetUrl` returns signed URL assigned to `videoUrl` | WIRED | `index.ts:19` import; `index.ts:113` call |
| `worker/src/index.ts main() tick` | `videoCleanup.ts` | `cleanupExpiredVideos(prisma)` called before `processPendingJob()` | WIRED | `index.ts:20` import; `index.ts:153` call |
| `src/app/status/page.tsx` | `src/components/status-view.tsx` | `initialVideoUrl` prop | WIRED | `page.tsx:64`; `StatusViewProps` line 44 in status-view |
| `src/components/status-view.tsx Realtime handler` | `videoUrl` state | `setVideoUrl(payload.new.videoUrl ?? null)` | WIRED | `status-view.tsx:110` |
| `src/components/status-view.tsx Video tab` | HTML5 `<video>` element | `videoUrl !== null` conditional | WIRED | `status-view.tsx:242-248` |
| `src/components/status-view.tsx polling fallback` | `videoUrl` state | `select` includes `videoUrl`; `setVideoUrl` called with result | WIRED | `status-view.tsx:130-141` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `status-view.tsx` Video tab | `videoUrl` state | `uploadVideoAndGetUrl` in worker → Prisma `job.update` → Supabase Realtime `postgres_changes` event → `setVideoUrl` | Yes — real signed URL from Supabase Storage | FLOWING |
| `status-view.tsx` Video tab | `stitchedTranscript` (for No clips found branch) | Prisma `job.update` → Realtime → `setStitchedTranscript` | Yes — real transcript data from Phase 3 pipeline | FLOWING |
| `src/app/status/page.tsx` | `job.videoUrl` | `prisma.job.findFirst` (no select clause = all fields) | Yes — Prisma returns all Job columns by default | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Worker test suite — all 57 tests pass | `cd worker && npm run test:run` | 9 files, 57 tests passed (711ms) | PASS |
| Frontend test suite — all 38 tests pass | `npm run test:run` (root) | 5 files, 38 tests passed (3.70s) | PASS |
| TDD commits exist | `git log --oneline -10` | RED `b39fe9a`, GREEN `2312875` (worker); RED `c371742`, GREEN `cdf2905` (frontend) | PASS |
| No SUPABASE_SERVICE_ROLE_KEY in Next.js app src | grep on `src/` | No matches found | PASS |
| No `dangerouslySetInnerHTML` in status-view.tsx | grep on `status-view.tsx` | Not present (comments warn against it; code uses JSX text nodes) | PASS |
| No `fluent-ffmpeg` usage in worker | grep on `worker/src/videoExtractor.ts` | Match is in a comment only ("no fluent-ffmpeg"); no import or usage | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VID-01 | 04-01 | System extracts planned video segments from the YouTube source | SATISFIED | `videoExtractor.ts` + `videoDownloader.ts` + wired in `index.ts` |
| VID-02 | 04-01 | System stitches extracted segments into one continuous playable video | SATISFIED | `videoStitcher.ts` concat demuxer + `storageUploader.ts` signed URL |
| VID-03 | 04-02 | User can play the stitched video in the browser | SATISFIED | `status-view.tsx` Video tab `<video controls src={videoUrl}>` |
| VID-04 | 04-01 | Anonymous video artifacts expire after a configured retention window | SATISFIED | `videoCleanup.ts` per-tick cleanup; `videoExpiresAt` set to `now + 24h` |
| JOB-03 | 04-01 | Worker cleans up expired storage artifacts | SATISFIED | `cleanupExpiredVideos(prisma)` called in `main()` each tick |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/status-view.tsx` | 272 | "Study notes will appear here in a future update." (Notes tab placeholder) | INFO | Notes tab is a known stub — Phase 5 scope; not a Phase 4 concern |

No `TBD`, `FIXME`, `XXX`, or unresolved debt markers found in any Phase 4 modified files.

---

## Security Review (Threat Model T-04-01 through T-04-SC)

| Threat ID | Category | Status | Verification |
|-----------|----------|--------|-------------|
| T-04-01 | Spoofing — youtubeUrl input to downloader | MITIGATED | `extractYouTubeVideoId()` is called at `index.ts:80` before the video pipeline; only the extracted alphanumeric ID is passed to `downloadYouTubeVideo` at `index.ts:104` |
| T-04-02 | Tampering — storage path | MITIGATED | `storagePath = \`jobs/${jobId}/output.mp4\`` where `jobId` is a Prisma-generated UUID; no user-controlled input; confirmed in `storageUploader.ts:40` |
| T-04-03 | Information Disclosure — SUPABASE_SERVICE_ROLE_KEY | MITIGATED | Key is only referenced in `worker/src/storageUploader.ts:27`; grep of `src/` finds zero matches; no NEXT_PUBLIC_ variant exists |
| T-04-04 | Information Disclosure — videoUrl signed URL | MITIGATED | Signed URL stored on RLS-protected Job row; Realtime channel filtered to `id=eq.${initialJobId}`; URL expires in 24h; confirmed in `status-view.tsx:103` |
| T-04-05 | DoS — large YouTube video download | ACCEPTED | Railway free tier /tmp space constraint acknowledged; OOM kills worker, which restarts; acceptable for MVP per plan |
| T-04-06 | Elevation of Privilege — Supabase Storage anon key | MITIGATED | `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` confirmed in `storageUploader.ts:25-28`; not the anon key |
| T-04-SC | Tampering — npm package install | MITIGATED | `ffmpeg-static` and `@distube/ytdl-core` are in `worker/package.json` only; no new packages in Next.js app |
| T-04-07 | Information Disclosure — videoUrl in Realtime payload | MITIGATED | Channel filter `id=eq.${initialJobId}` in `status-view.tsx:103`; only job owner receives payload |
| T-04-08 | Tampering — videoUrl as `<video src>` | MITIGATED | `videoUrl` comes from DB via Realtime (server-controlled); no user-supplied string; no XSS risk from `src` attribute; CSP from Phase 1 restricts `media-src` |
| T-04-09 | Information Disclosure — topic in "No clips found" | MITIGATED | `{topic}` is a JSX text node child at `status-view.tsx:240`; no `dangerouslySetInnerHTML` confirmed |

---

## Human Verification Required

Six items require human sign-off before this feature is fully operational in production. These are infrastructure prerequisites that cannot be verified from the codebase alone.

### 1. End-to-End Video Job Run

**Test:** Submit a YouTube URL and topic via the app; wait for DONE status; click the Video tab.
**Expected:** Video tab shows an HTML5 `<video>` element with native browser controls; the stitched clip plays correctly.
**Why human:** Requires a live worker with Supabase Storage configured, SUPABASE_SERVICE_ROLE_KEY set in worker environment, and @distube/ytdl-core successfully downloading from YouTube.

### 2. CORS and Signed URL Playback

**Test:** After the video appears in the Video tab, click play.
**Expected:** Browser loads the video from the Supabase Storage signed URL without CORS errors or CSP `media-src` violations in the console.
**Why human:** Supabase Storage CORS must be configured to allow the app's origin for video playback (D-08 / RESEARCH.md Open Question 1). This is a manual dashboard configuration.

### 3. No-Match Job Shows "No Clips Found"

**Test:** Submit a YouTube URL for a video where the specified topic does not appear anywhere in the transcript.
**Expected:** Video tab renders: `No clips found for "<topic>".` (not a `<video>` element or "Working on it...").
**Why human:** Requires a live end-to-end no-match job run; the code path is unit-tested (test suite confirms the conditional logic) but real-world behavior with a live YouTube video is unverified.

### 4. Supabase Storage Bucket Configuration

**Test:** Open Supabase dashboard → Storage section.
**Expected:** Bucket named `clip-videos` exists with "Private" access control (no public URLs). Files are not publicly accessible.
**Why human:** Must be created manually in the Supabase dashboard before first job run; no bucket is auto-created by the worker.

### 5. Worker Environment Variables

**Test:** Check worker/.env.local and Railway environment variables.
**Expected:** Both `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are set. `SUPABASE_SERVICE_ROLE_KEY` is the service role key (not the anon key), and is not present in any Next.js env file.
**Why human:** Environment secrets cannot be verified from codebase.

### 6. 24-Hour Expiry and Cleanup

**Test:** After 24 hours from a successful job, check: (a) the Video tab shows a browser error loading the video; (b) the Job row in Supabase dashboard has `videoUrl = null` and `videoExpiresAt = null`.
**Expected:** Signed URL has expired (HTTP 400 from Supabase Storage); `cleanupExpiredVideos` has already nulled both fields on the next polling tick after expiry.
**Why human:** Time-dependent behavior; requires waiting 24h and inspecting the Supabase dashboard.

---

## Gaps Summary

No automated gaps found. All 10 observable truths are verified in the codebase. All artifacts exist and are substantive (not stubs). All key links are wired. Both test suites pass (57/57 worker tests, 38/38 frontend tests).

The `human_needed` status reflects six infrastructure prerequisites that require manual setup and sign-off before the feature is operationally complete in any deployed environment. These are expected for an MVP feature that depends on external service configuration (Supabase Storage bucket + CORS, worker env vars).

The Notes tab placeholder ("Study notes will appear here in a future update.") is an explicit Phase 5 deferral, not a Phase 4 gap.

---

_Verified: 2026-06-25T23:05:00Z_
_Verifier: Claude (gsd-verifier)_
