---
phase: 02-transcript-and-exact-search
plan: 02
subsystem: worker
tags: [worker, matcher, exact-matching, tdd, normalize, clip-plan]
dependency_graph:
  requires:
    - TranscriptSegment interface (worker/src/types.ts, from 02-01)
    - ClipMatch interface (worker/src/types.ts, from 02-01)
    - worker/src/index.ts polling loop (from 02-01)
    - prisma/schema.prisma transcript and clipPlan columns (from 02-01)
  provides:
    - normalize(text) pure utility function (worker/src/matcher.ts)
    - findMatches(segments, topic) exact phrase matcher with D-07 and D-08 support
    - buildClipPlan(segments, topic) alias for findMatches, called by index.ts
    - clipPlan populated on Job row (worker/src/index.ts)
  affects:
    - worker/src/index.ts processPendingJob — now writes real clipPlan, not empty placeholder
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle for pure utility module (matcher.ts)
    - ESM .js extensions on relative imports within worker/
    - String.prototype.includes() for topic matching (no regex injection risk)
    - Math.round(seg.offset * 1000) for ms conversion from youtube-transcript-plus offset field
key_files:
  created:
    - worker/src/matcher.ts
    - worker/src/__tests__/matcher.test.ts
  modified:
    - worker/src/index.ts
decisions:
  - Use seg.offset (not seg.start) throughout — TranscriptSegment interface enforces this
  - buildClipPlan is a thin alias for findMatches — same signature, enables clear index.ts call site
  - Empty clipPlan (no topic matches) still results in DONE status — FAILED is reserved for transcript errors only
  - Test expectation for multiple-match case uses [1,2] segmentIndices (cross-boundary fires before single-segment for index 1) — correct per algorithm spec
metrics:
  duration: 15 min
  completed: "2026-06-18"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 02 Plan 02: Exact Topic Matching + clipPlan Write Summary

**One-liner:** Pure normalize/findMatches/buildClipPlan utilities with cross-boundary phrase matching (D-06, D-07, D-08) wired into the worker processing loop via TDD RED/GREEN cycle.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for normalize/findMatches/buildClipPlan | 9843f5f | worker/src/__tests__/matcher.test.ts |
| 1 (GREEN) | Implement matcher.ts — normalize, findMatches, buildClipPlan | 9aec576 | worker/src/matcher.ts, worker/src/__tests__/matcher.test.ts |
| 2 | Wire buildClipPlan into worker processPendingJob loop | c6e5b50 | worker/src/index.ts |

## What Was Built

- **worker/src/matcher.ts** — Pure utility module with no side effects or I/O:
  - `normalize(text)`: lowercase -> strip `[^\w\s]` -> collapse whitespace -> trim (D-06)
  - `findMatches(segments, topic)`: iterates segments; D-07 single-segment check first, D-08 cross-boundary check when single fails; uses `seg.offset` (not `seg.start`) for millisecond conversion via `Math.round(seg.offset * 1000)`; returns `[]` on no matches (empty array, not null)
  - `buildClipPlan(segments, topic)`: alias for `findMatches` — provides clear call-site naming in index.ts

- **worker/src/__tests__/matcher.test.ts** — 13 test cases across 3 describe blocks:
  - `normalize`: lowercase, punctuation strip, whitespace collapse, apostrophe strip, trim
  - `findMatches`: empty segments, no-match returns `[]`, single-segment match (D-07) with correct ms values, cross-boundary match (D-08) with combined text and `[i, i+1]` segmentIndices, multiple-match traversal, NaN guard (offset, not start)
  - `buildClipPlan`: aliases findMatches (same result), empty returns `[]`

- **worker/src/index.ts** — Updated `processPendingJob()`:
  - Imports `buildClipPlan` from `./matcher.js`
  - After `fetchTranscript(videoId)`, calls `const clipPlan = buildClipPlan(segments, job.topic)`
  - DONE update writes both `transcript` and `clipPlan` cast as `Prisma.InputJsonValue`
  - FAILED path unchanged — only fires on caught exceptions from transcript fetch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectation for multiple-match case corrected**
- **Found during:** Task 1 GREEN phase (first test run)
- **Issue:** Test expected second match at `segmentIndices: [2]` (single-segment), but algorithm correctly fires cross-boundary check for index 1 + 2 first ("some other content neural networks again" includes "neural networks"), yielding `segmentIndices: [1, 2]`
- **Fix:** Updated test comment and expectation to `[1, 2]` — matches correct D-08 algorithm behavior
- **Files modified:** `worker/src/__tests__/matcher.test.ts`
- **Commit:** 9aec576

### Environment Setup (Not a Plan Deviation)

The worktree branch was 7 commits behind master (missing all wave-1 work). Resolved by rebasing onto master before starting. No plan deviation.

Prisma generated client was not present in the worktree (gitignored) and could not be generated without `.env.local`. Resolved by running `prisma generate` from the main repo and copying the updated client to the worktree. The TypeScript types for `transcript` and `clipPlan` fields were absent from the previously-generated client (it predated the schema update in 02-01). After regeneration, `npx tsc --noEmit` passes with 0 errors.

## TDD Gate Compliance

- RED commit: `9843f5f` — `test(02-02): add failing matcher tests for normalize/findMatches/buildClipPlan (RED)` — tests failed with "Cannot find module '../matcher.js'"
- GREEN commit: `9aec576` — `feat(02-02): implement normalize, findMatches, buildClipPlan in matcher.ts (GREEN)` — all 20 worker tests pass

## Verification Results

- `npx tsc --noEmit` from project root: PASSED (0 errors)
- `npm run test:run` from project root: PASSED (30 tests across 4 files — no regression)
- `npm run test:run` from worker/: PASSED (20 tests across 2 files — 7 transcript + 13 matcher)
- `worker/src/matcher.ts` contains `seg.offset` and does NOT contain `seg.start`
- `worker/src/matcher.ts` imports from `'./types.js'` (relative, .js extension)
- `worker/src/index.ts` contains `buildClipPlan(segments, job.topic)` and both `transcript:` and `clipPlan:` in DONE update

## Known Stubs

None. The `clipPlan: [] as unknown as Prisma.InputJsonValue` stub from plan 02-01 has been replaced with the actual `buildClipPlan(segments, job.topic)` result. No remaining stubs in files touched by this plan.

## Threat Surface Scan

No new trust boundaries beyond those documented in the plan's threat_model:
- `normalize()` lowercases and strips non-word chars; `findMatches` uses `String.prototype.includes()` — no regex injection vector (T-02-06 mitigated)
- O(n) matching algorithm — acceptable for Phase 2 MVP video lengths (T-02-07 accepted)
- `clipPlan` adds no new sensitive surface beyond `job.topic` already stored (T-02-08 accepted)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| worker/src/matcher.ts | FOUND |
| worker/src/__tests__/matcher.test.ts | FOUND |
| worker/src/index.ts (modified) | FOUND |
| commit 9843f5f (RED) | FOUND |
| commit 9aec576 (GREEN) | FOUND |
| commit c6e5b50 (Task 2) | FOUND |
| npx tsc --noEmit passes | PASSED |
| npm run test:run (root) 30 tests | PASSED |
| npm run test:run (worker/) 20 tests | PASSED |
