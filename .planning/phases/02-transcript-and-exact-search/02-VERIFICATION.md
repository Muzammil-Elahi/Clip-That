---
phase: 02-transcript-and-exact-search
verified: 2026-06-17T20:28:00Z
status: complete
score: 7/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm SUB-03 satisfaction — no 'choose exact matching' UI toggle exists"
    expected: "Submitting a job via the form uses exact matching. Phase 2 has no semantic alternative yet, so exact matching being the hardcoded default satisfies the requirement intent. Confirm the product owner accepts 'exact matching is the only mode' as fulfilling 'user can choose exact matching' at this phase."
    why_human: "SUB-03 says 'User can choose exact transcript matching.' The submission form has only a URL + topic input — no mode selector. Whether defaulting to exact matching satisfies the requirement's 'choose' verb is a product decision, not a code check."
  - test: "End-to-end worker integration — PENDING job transitions to DONE with transcript and clipPlan"
    expected: "After submitting a job via the Next.js form and starting the worker (node --experimental-strip-types src/index.ts from worker/), the Supabase Job row should transition PENDING → PROCESSING → DONE with non-null transcript and non-empty clipPlan columns (for a video+topic with known mentions)."
    why_human: "Requires a live Railway/local worker process, a real YouTube video, and Supabase database access. Cannot verify with static code analysis."
  - test: "End-to-end worker integration — unsupported video transitions to FAILED"
    expected: "Submitting a job for a YouTube video with no captions should result in the job transitioning to FAILED with errorMessage 'This video doesn't have a usable transcript.'"
    why_human: "Requires live YouTube API call and running worker. Cannot verify without network access and a running process."
---

# Phase 2: Transcript and Exact Search — Verification Report

**Phase Goal:** Retrieve timestamped YouTube transcripts and identify direct topic mentions.
**Verified:** 2026-06-17T20:28:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | System can retrieve timestamped transcript data for supported YouTube videos | VERIFIED | `worker/src/transcript.ts:fetchTranscript` calls `YoutubeTranscript.fetchTranscript(videoId, { retries: 2, retryDelay: 1000 })` and returns segments with offset/duration fields; wired in `index.ts` line 37 |
| 2 | System returns a clear unsupported-video state when transcript data is unavailable | VERIFIED | `mapTranscriptError` maps `YoutubeTranscriptNotAvailableError` and `YoutubeTranscriptDisabledError` to "This video doesn't have a usable transcript."; `index.ts` catch block (line 48-53) calls `mapTranscriptError` and sets `status: 'FAILED'` with `errorMessage` |
| 3 | System finds exact topic mentions and stores an initial clip plan from matching transcript spans | VERIFIED | `matcher.ts:buildClipPlan` aliased from `findMatches`; `index.ts` line 38 calls `buildClipPlan(segments, job.topic)` and line 44 writes `clipPlan` to the database as `Prisma.InputJsonValue` alongside `status: 'DONE'` |
| 4 | A PENDING job is picked up, set to PROCESSING, then written to DONE or FAILED with no manual intervention | VERIFIED | `index.ts:processPendingJob` lines 24-56: `findFirst({ where: { status: 'PENDING' } })` → update to `PROCESSING` → try/catch → `DONE` or `FAILED` |
| 5 | The worker process starts, polls every 4 seconds, and shuts down gracefully on SIGTERM | VERIFIED | `index.ts` lines 15-21 (SIGTERM handler waits for `processingJob`, disconnects Prisma, exits 0); lines 61-64 `while (!shutdown)` with `await sleep(4000)` |
| 6 | normalize() strips punctuation, collapses whitespace, and lowercases input | VERIFIED | `matcher.ts` lines 12-18: `.toLowerCase()` → `.replace(/[^\w\s]/g, '')` → `.replace(/\s+/g, ' ')` → `.trim()`; 5 unit tests confirm each transformation |
| 7 | findMatches() detects a topic phrase that spans two consecutive segments (D-08 cross-boundary) | VERIFIED | `matcher.ts` lines 47-58: cross-boundary check concatenates `seg.text + ' ' + nextSeg.text` and increments `i` to skip consumed segment; test `matches across consecutive segment boundary` passes |
| 8 | User can choose exact transcript matching (SUB-03) | UNCERTAIN | Submission form (`src/components/submission-form.tsx`) has only URL + topic inputs — no matching-mode selector. Exact matching is the hardcoded sole mode. Whether "choose" is satisfied by default-only is a product decision. |

**Score:** 7/8 truths verified (1 uncertain — human decision required)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | Job model with `transcript Json?` and `clipPlan Json?` fields | VERIFIED | Lines 25-26 contain both fields; migration `20260618000004_add_transcript_clip_plan` adds both as JSONB columns |
| `worker/package.json` | ESM package with `"type": "module"`, start script, test script | VERIFIED | `"type": "module"` line 3; `"start": "node --experimental-strip-types src/index.ts"` line 6; `tsx` not present |
| `worker/src/index.ts` | Polling worker with `while(!shutdown)` loop | VERIFIED | Line 61: `while (!shutdown)` loop; `processPendingJob()` called; `await sleep(4000)` line 63 |
| `worker/src/prisma.ts` | Service-role PrismaClient using `WORKER_DATABASE_URL` | VERIFIED | Line 11: `process.env.WORKER_DATABASE_URL!`; no `globalForPrisma` |
| `worker/src/transcript.ts` | `fetchTranscript` and `mapTranscriptError` functions | VERIFIED | Both exported; all 5 error classes mapped; fallback present |
| `worker/src/types.ts` | `TranscriptSegment` and `ClipMatch` interfaces | VERIFIED | Both exported; `offset: number` used (not `start`); JSDoc warns "NOT 'start'" |
| `worker/src/__tests__/transcript.test.ts` | Unit tests for error mapping | VERIFIED | 7 tests covering all 5 error class mappings + fallback + non-Error value |
| `worker/src/matcher.ts` | `normalize`, `findMatches`, `buildClipPlan` functions | VERIFIED | All three exported; imports from `'./types.js'`; no `@/` aliases; no `seg.start` |
| `worker/src/__tests__/matcher.test.ts` | Unit tests for normalize/findMatches/D-06/D-07/D-08 | VERIFIED | 13 tests: 5 normalize + 6 findMatches + 2 buildClipPlan |
| `prisma/migrations/20260618000004_add_transcript_clip_plan/migration.sql` | Migration adding transcript and clipPlan columns | VERIFIED | SQL: `ADD COLUMN "clipPlan" JSONB` and `ADD COLUMN "transcript" JSONB` |
| `src/types/job.ts` | Extended with `TranscriptSegment`, `ClipMatch`, and Job fields | VERIFIED | Lines 16-32 define both interfaces; lines 44-45 extend Job with `transcript: TranscriptSegment[] \| null` and `clipPlan: ClipMatch[] \| null` |
| `worker/src/youtube.ts` | Worker-local `extractYouTubeVideoId` helper | VERIFIED | Created as worker-local copy to avoid cross-package path; used in `index.ts` line 6 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `worker/src/index.ts` | `worker/src/prisma.ts` | `prisma.job.findFirst({ where: { status: 'PENDING' } })` | VERIFIED | `index.ts` line 24: `prisma.job.findFirst({ where: { status: 'PENDING' } })` |
| `worker/src/index.ts` | `worker/src/transcript.ts` | `fetchTranscript(videoId)` | VERIFIED | `index.ts` line 5 import; line 37: `const segments = await fetchTranscript(videoId)` |
| `worker/src/prisma.ts` | `process.env.WORKER_DATABASE_URL` | `PrismaPg connectionString` | VERIFIED | `prisma.ts` line 11: `connectionString: process.env.WORKER_DATABASE_URL!` |
| `worker/src/index.ts` | `worker/src/matcher.ts` | `buildClipPlan(segments, job.topic)` | VERIFIED | `index.ts` line 7 import; line 38: `const clipPlan = buildClipPlan(segments, job.topic)` |
| `worker/src/matcher.ts` | `worker/src/types.ts` | `import type { TranscriptSegment, ClipMatch }` | VERIFIED | `matcher.ts` line 6: `import type { TranscriptSegment, ClipMatch } from './types.js'` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `worker/src/index.ts` | `segments` (transcript data) | `fetchTranscript(videoId)` → `YoutubeTranscript.fetchTranscript()` (youtube-transcript-plus) | Yes — live YouTube API call, re-throws on failure | FLOWING |
| `worker/src/index.ts` | `clipPlan` | `buildClipPlan(segments, job.topic)` → `findMatches()` with real segments array | Yes — iterates real segments, returns `[]` on no match (not null) | FLOWING |
| `worker/src/index.ts` | `transcript` + `clipPlan` written to DB | `prisma.job.update(... transcript: segments, clipPlan: clipPlan ...)` | Yes — both cast to `Prisma.InputJsonValue` and written on DONE path | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Worker test suite — 20 tests across transcript + matcher modules | `npm run test:run` from `worker/` | 20 passed (2 files), 497ms | PASS |
| Root project test suite — no regression | `npm run test:run` from project root | 30 passed (4 files), 3.71s | PASS |
| TypeScript compilation clean | `npx tsc --noEmit` from project root | Exit 0 (no output) | PASS |
| `normalize` lowercases, strips punctuation, collapses whitespace | Unit test in `matcher.test.ts` | 5 tests passing | PASS |
| `findMatches` cross-boundary D-08 | Unit test "matches across consecutive segment boundary" | 1 test passing | PASS |
| No `@/` path aliases in worker files | `grep -r "@/" worker/src/` | No matches | PASS |
| `tsx` not in worker dependencies | `grep "tsx" worker/package.json` | No matches | PASS |
| `seg.start` not used in matcher | `grep -r "seg\.start" worker/src/` | No matches | PASS |
| `setInterval` not used in worker index | `grep "setInterval" worker/src/index.ts` | No matches | PASS |
| `globalForPrisma` not in worker prisma client | `grep "globalForPrisma" worker/src/prisma.ts` | Not found (only in JSDoc comment) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SUB-03 | 02-01-PLAN | User can choose exact transcript matching | UNCERTAIN — human needed | No UI toggle exists; exact matching is hardcoded sole mode; Phase 6 adds semantic matching as alternative. Whether "choose" is satisfied by default is a product decision. |
| TRN-01 | 02-01-PLAN | System can retrieve timestamped transcript or caption data for supported YouTube videos | SATISFIED | `fetchTranscript` calls youtube-transcript-plus with retry; returns `TranscriptSegment[]` with `offset`, `duration`, `lang` fields |
| TRN-02 | 02-01-PLAN | System can detect when a YouTube video has no usable transcript and return a clear unsupported-video state | SATISFIED | `mapTranscriptError` maps `NotAvailableError`/`DisabledError` → "This video doesn't have a usable transcript."; FAILED status written to DB with user-facing message |
| TRN-03 | 02-02-PLAN | System can normalize transcript text for matching while preserving source timestamps | SATISFIED | `normalize()` strips punctuation/whitespace/case; `findMatches` uses `seg.offset` (never mutated) for `startMs`/`endMs` computation |
| MAT-01 | 02-02-PLAN | System can find direct topic mentions in the transcript using exact matching | SATISFIED | `findMatches` uses `String.prototype.includes()` on normalized text; D-07 single-segment and D-08 cross-boundary both implemented |
| CLP-01 | 02-02-PLAN | System can create a clip plan from all relevant transcript segments | SATISFIED | `buildClipPlan` returns `ClipMatch[]` with `startMs`, `endMs`, `text`, `segmentIndices`; written to `clipPlan` JSON column on DONE path; empty array (no matches) still writes DONE — not FAILED |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No debt markers (TBD, FIXME, XXX), no placeholder returns, no hardcoded empty data in active code paths, no `@/` aliases in worker files, no `tsx` installed.

The `clipPlan: [] as unknown as Prisma.InputJsonValue` stub documented in 02-01-SUMMARY.md under "Known Stubs" has been confirmed replaced in `worker/src/index.ts` by `buildClipPlan(segments, job.topic)` — the actual matcher result, not an empty array.

### Human Verification Required

#### 1. SUB-03 — Exact Matching Mode Choice

**Test:** Open the submission form at the app root. Confirm that submitting a YouTube URL + topic implicitly uses exact transcript matching (no other mode is offered or implied). Ask the product owner: does "User can choose exact transcript matching" (SUB-03) mean (a) a UI selector between modes, or (b) the system defaults to exact matching before semantic matching is introduced in Phase 6?

**Expected:** If interpretation (b) is accepted, SUB-03 is satisfied by Phase 2's implementation — exact matching is the only processing mode and is automatically applied on every job. If interpretation (a) is required, a UI toggle is missing and Phase 2 has a gap.

**Why human:** The literal text of SUB-03 says "choose" but no choice widget exists. The Phase 6 plan introduces semantic matching as an opt-in, suggesting exact matching is the unconditional default until Phase 6. Whether that satisfies "choose" requires product owner judgment.

#### 2. End-to-End Integration — DONE path

**Test:** Submit a job via the Next.js app for a YouTube video known to have captions (e.g., any video with auto-generated or manual captions) with a topic phrase that appears in the transcript. Start the worker with `node --experimental-strip-types src/index.ts` from the `worker/` directory. Monitor the Supabase Job row.

**Expected:** Job transitions PENDING → PROCESSING → DONE. The `transcript` column contains a JSON array of segments (non-null, non-empty). The `clipPlan` column contains a JSON array — non-empty if the topic phrase appears in the transcript, empty array `[]` if it does not.

**Why human:** Requires live YouTube network access, a running worker process with `WORKER_DATABASE_URL` set, and Supabase database inspection. Cannot be verified with static code analysis.

#### 3. End-to-End Integration — FAILED path

**Test:** Submit a job for a YouTube video known to have no captions (e.g., a video with only music or a video in a language with no caption track, or an invalid video ID). Start the worker.

**Expected:** Job transitions PENDING → PROCESSING → FAILED. The `errorMessage` column contains "This video doesn't have a usable transcript." (for no-transcript case) or the appropriate error string from `mapTranscriptError`.

**Why human:** Same reason as above — requires live network and running worker.

### Gaps Summary

No BLOCKER gaps found. All code artifacts exist, are substantive (not stubs), are wired into the processing loop, and data flows through them.

One UNCERTAIN item exists for human decision (SUB-03 / "choose" verb interpretation). This does not block the technical goal ("retrieve timestamped YouTube transcripts and identify direct topic mentions") — that goal is fully achieved in code.

---

_Verified: 2026-06-17T20:28:00Z_
_Verifier: Claude (gsd-verifier)_
