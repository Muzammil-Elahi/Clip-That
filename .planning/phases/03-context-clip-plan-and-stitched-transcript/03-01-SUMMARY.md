---
phase: "03"
plan: "01"
subsystem: worker
tags: [context-expansion, overlap-merge, stitched-transcript, prisma, tdd]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [contextExpander, stitchedTranscript, StitchedTranscriptEntry, stitchedTranscript-db-column]
  affects: [worker-processing-loop, prisma-schema, 03-02]
tech_stack:
  added: []
  patterns: [pure-function-module, segment-boundary-walk, interval-merge, prisma-json-cast, esm-js-extensions, tdd-red-green]
key_files:
  created:
    - worker/src/contextExpander.ts
    - worker/src/stitchedTranscript.ts
    - worker/src/__tests__/contextExpander.test.ts
    - worker/src/__tests__/stitchedTranscript.test.ts
  modified:
    - worker/src/types.ts
    - worker/src/index.ts
    - prisma/schema.prisma
decisions:
  - "Segment-boundary walk decrements leftIdx THEN accumulates, per D-01 from CONTEXT.md"
  - "mergeOverlappingWindows: curr.startMs <= last.endMs merges adjacent (touching) windows"
  - "No gap markers in stitchedTranscript per D-05"
  - "Prisma migration (add-stitched-transcript) requires user to run in terminal with DIRECT_URL"
metrics:
  duration: "9 min"
  completed: "2026-06-24"
  tasks_completed: 2
  files_changed: 7
---

# Phase 03 Plan 01: Context Expander and Stitched Transcript Summary

**One-liner:** Segment-boundary context expansion (30s walk) with overlap merge, producing StitchedTranscriptEntry[] written to Job.stitchedTranscript JSONB via Prisma.

## What Was Built

Two new pure-function worker modules, extended types, a Prisma schema change, and updated worker processing loop:

1. **`worker/src/contextExpander.ts`** — exports `CONTEXT_WINDOW_MS` (30000), `ExpandedWindow` interface, `expandContextWindows(segments, matches, contextMs?)`, `mergeOverlappingWindows(windows)`.
2. **`worker/src/stitchedTranscript.ts`** — exports `buildStitchedTranscript(segments, mergedWindows)` returning `StitchedTranscriptEntry[]`.
3. **`worker/src/types.ts`** — `StitchedTranscriptEntry` interface added after `ClipMatch`.
4. **`prisma/schema.prisma`** — `stitchedTranscript Json?` added after `clipPlan` on Job model.
5. **`worker/src/index.ts`** — imports and calls all three new functions between `buildClipPlan()` and `prisma.job.update()`; passes `stitchedTranscript` to the DONE update.
6. **Test files** — `contextExpander.test.ts` (9 cases for CLP-02/CLP-03) and `stitchedTranscript.test.ts` (5 cases for CLP-04/STR-01), both passing.

## TDD Gate Compliance

- RED: `test(03-01)` commit `2f8c98f` — test files written first, failed with "Cannot find module"
- GREEN: `feat(03-01)` commit `48218e7` — implementation written, 30 tests pass

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for contextExpander and stitchedTranscript | 2f8c98f | worker/src/__tests__/contextExpander.test.ts, stitchedTranscript.test.ts |
| 1 (GREEN) | Implement contextExpander and stitchedTranscript pure functions | 48218e7 | worker/src/types.ts, worker/src/contextExpander.ts, worker/src/stitchedTranscript.ts |
| 2 | Add stitchedTranscript to schema and wire worker loop | f5aa871 | prisma/schema.prisma, worker/src/index.ts |

## Deviations from Plan

None — plan executed exactly as written.

The `transcript.test.ts` failure in `cd worker && npm run test:run` is a pre-existing worktree isolation issue (`youtube-transcript-plus` not installed in the worktree's node_modules). It was failing before Task 1 and is unrelated to this plan's changes. All 30 tests in the three relevant test files pass.

## Pending User Action (Blocking for Phase Completion)

**Task 2 — Step 4 — Prisma migration** must be run by the user in their local terminal:

```bash
npx prisma migrate dev --name add-stitched-transcript
npx prisma generate
cd worker && npx prisma generate --schema=../prisma/schema.prisma && npm run build
```

This requires `DIRECT_URL` in `.env.local` pointing to the session-mode pooler URL. Without this step, the worker will fail at runtime (Prisma client does not have `stitchedTranscript` field).

## Requirements Satisfied

| ID | Description | Status |
|----|-------------|--------|
| CLP-02 | System adds ~30s context around each match via segment-boundary walk | Done |
| CLP-03 | System merges overlapping context windows | Done |
| CLP-04 | System preserves source timestamps (sourceStartMs, sourceEndMs) per entry | Done |
| STR-01 | System generates stitched transcript as ordered StitchedTranscriptEntry[] | Done |

## Known Stubs

None — all functions are fully implemented with real logic. The `stitchedTranscript` field is written with real data on every DONE job.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. The new JSONB column is written by the worker (same trust boundary as `clipPlan` and `transcript`). T-03-04 mitigation (Realtime channel filtered to `id=eq.${initialJobId}`, RLS on Job table) is handled by existing infrastructure not changed in this plan.

## Self-Check

### Files exist

- FOUND: worker/src/contextExpander.ts
- FOUND: worker/src/stitchedTranscript.ts
- FOUND: worker/src/types.ts (contains StitchedTranscriptEntry)
- FOUND: worker/src/__tests__/contextExpander.test.ts
- FOUND: worker/src/__tests__/stitchedTranscript.test.ts
- FOUND: prisma/schema.prisma (contains stitchedTranscript Json?)
- FOUND: worker/src/index.ts (imports and calls all three functions)

### Commits exist

- 2f8c98f: test(03-01): add failing tests for contextExpander and stitchedTranscript
- 48218e7: feat(03-01): implement contextExpander and stitchedTranscript pure functions
- f5aa871: feat(03-01): add stitchedTranscript to schema and wire worker processing loop

## Self-Check: PASSED
