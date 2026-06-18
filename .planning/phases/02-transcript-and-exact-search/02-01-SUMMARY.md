---
phase: 02-transcript-and-exact-search
plan: 01
subsystem: worker
tags: [worker, prisma, transcript, youtube, tdd, migration]
dependency_graph:
  requires: []
  provides:
    - TranscriptSegment interface (src/types/job.ts, worker/src/types.ts)
    - ClipMatch interface (src/types/job.ts, worker/src/types.ts)
    - transcript Json? column (prisma/schema.prisma)
    - clipPlan Json? column (prisma/schema.prisma)
    - worker/src/prisma.ts PrismaClient (service-role)
    - worker/src/transcript.ts fetchTranscript + mapTranscriptError
    - worker/src/index.ts polling loop
  affects:
    - Job model in Supabase (new columns)
    - Prisma client (regenerated)
tech_stack:
  added:
    - youtube-transcript-plus@2.0.0 (worker dep)
    - vitest@^4.1.8 (worker devDep)
    - pg@^8.21.0 (worker dep, for PrismaPg adapter)
    - dotenv@^17.4.2 (worker dep, for .env.local loading)
  patterns:
    - ESM worker with "type": "module" in package.json
    - Node 22 --experimental-strip-types for zero-build TypeScript execution
    - while(!shutdown) polling loop with SIGTERM graceful shutdown
    - WORKER_DATABASE_URL service-role bypass of RLS
    - TDD RED/GREEN cycle for transcript error mapping
key_files:
  created:
    - worker/package.json
    - worker/vitest.config.ts
    - worker/.gitignore
    - worker/src/types.ts
    - worker/src/prisma.ts
    - worker/src/transcript.ts
    - worker/src/index.ts
    - worker/src/youtube.ts
    - worker/src/__tests__/transcript.test.ts
    - prisma/migrations/20260618000004_add_transcript_clip_plan/migration.sql
  modified:
    - prisma/schema.prisma (added transcript Json? and clipPlan Json?)
    - src/types/job.ts (added TranscriptSegment, ClipMatch interfaces and extended Job)
decisions:
  - Use worker/src/youtube.ts local copy of extractYouTubeVideoId to avoid cross-package relative path from worker/ to src/lib/youtube.ts
  - DONE update writes clipPlan as empty array placeholder; plan 02-02 will populate it
  - No tsconfig in worker/ — rely on Node 22 --experimental-strip-types per RESEARCH.md recommendation
metrics:
  duration: 25 min
  completed: "2026-06-18"
  tasks_completed: 3
  files_created: 10
  files_modified: 2
---

# Phase 02 Plan 01: Worker Scaffold + Transcript Retrieval Summary

**One-liner:** Railway worker scaffold with youtube-transcript-plus ESM integration, Prisma JSON column migration, and mapTranscriptError TDD unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend Prisma schema + add shared types | 93e0ab8 | prisma/schema.prisma, src/types/job.ts, worker/src/types.ts |
| 2 | Prisma migration — add transcript + clipPlan columns | 7d6326e | prisma/migrations/20260618000004_add_transcript_clip_plan/ |
| 3 (RED) | Scaffold worker — failing tests | 513c894 | worker/package.json, worker/vitest.config.ts, worker/src/__tests__/transcript.test.ts |
| 3 (GREEN) | Scaffold worker — implementation | 3b71c86 | worker/src/transcript.ts, worker/src/prisma.ts, worker/src/index.ts, worker/src/youtube.ts, worker/.gitignore |
| Deviation | Fix constructor arg count for no-arg error classes | 6f1ae6d | worker/src/__tests__/transcript.test.ts |

## What Was Built

The worker/ subdirectory at project root is now a fully scaffolded Railway worker service:

- **worker/package.json** — ESM package with `"type": "module"`, `youtube-transcript-plus@2.0.0`, Prisma 7 deps, and `node --experimental-strip-types` start script.
- **worker/src/transcript.ts** — `fetchTranscript(videoId)` calls the library with retry config; `mapTranscriptError(err)` maps all library error classes to plain-language user-facing strings per D-11 convention.
- **worker/src/prisma.ts** — `PrismaClient` with `PrismaPg` adapter using `WORKER_DATABASE_URL` (service-role postgres, bypasses RLS). No `globalForPrisma` singleton.
- **worker/src/index.ts** — Polling entry point: `while (!shutdown)` loop polling every 4 seconds. `processPendingJob()` claims PENDING → PROCESSING → fetches transcript → DONE (with transcript JSON and empty clipPlan placeholder) or FAILED (with mapTranscriptError message). SIGTERM handler waits for in-flight job before disconnecting.
- **worker/src/youtube.ts** — Worker-local copy of `extractYouTubeVideoId()` to avoid cross-package relative imports.
- **worker/src/types.ts** — Worker-local copy of `TranscriptSegment` and `ClipMatch` interfaces.
- **Prisma schema** — `transcript Json?` and `clipPlan Json?` added to Job model; migration `20260618000004_add_transcript_clip_plan` applied to Supabase.
- **src/types/job.ts** — Extended with `TranscriptSegment`, `ClipMatch` interfaces and `transcript`/`clipPlan` fields on `Job`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed constructor argument count for no-arg error classes**
- **Found during:** Task 3 TypeScript verification after implementation
- **Issue:** Test file instantiated `YoutubeTranscriptTooManyRequestError('vid123')` and `YoutubeTranscriptInvalidVideoIdError('bad-id')` with arguments, but the library's TypeScript declarations show both constructors take 0 arguments (`constructor()`).
- **Fix:** Changed to `new YoutubeTranscriptTooManyRequestError()` and `new YoutubeTranscriptInvalidVideoIdError()` — matches the actual constructor signatures.
- **Files modified:** `worker/src/__tests__/transcript.test.ts`
- **Commit:** 6f1ae6d

### Additions Not in Plan

**worker/src/youtube.ts** — The plan mentioned either using a relative path `../../src/lib/youtube.js` or copying into a worker helper. A cross-package relative path was rejected in favor of a worker-local copy to keep the worker self-contained for Railway deployment. This was the plan's suggested alternative.

**worker/.gitignore** — Created to exclude `node_modules/` and `.env.local` from git. Not mentioned in the plan but required for correct git behavior.

## TDD Gate Compliance

- RED commit: `513c894` — `test(02-01): add failing transcript unit tests (RED)` — tests failed as expected (module not found)
- GREEN commit: `3b71c86` — `feat(02-01): scaffold worker package with transcript module (GREEN)` — all 7 tests pass

## Verification Results

- `npx tsc --noEmit` from project root: PASSED (0 errors)
- `npm run test:run` from project root: PASSED (30 tests across 4 files)
- `npm run test:run` from worker/: PASSED (7 tests, 1 test file)
- `npx prisma migrate status`: "Database schema is up to date!"
- No `@/` path aliases in worker/ files
- `tsx` is NOT in worker/package.json

## Known Stubs

- `worker/src/index.ts` line ~44: `clipPlan: [] as unknown as Prisma.InputJsonValue` — empty array placeholder. Plan 02-02 will populate this with actual matched segments from the exact matching step.

## Threat Surface Scan

No new trust boundaries introduced beyond those documented in the plan's `<threat_model>`. WORKER_DATABASE_URL is used correctly (not hardcoded, not exposed in Next.js env namespace). Video ID is extracted via `extractYouTubeVideoId()` before being passed to `fetchTranscript()` per T-02-02 mitigation.

## Self-Check: PASSED

All files confirmed present on disk. All commits confirmed in git log.

| Check | Result |
|-------|--------|
| prisma/schema.prisma | FOUND |
| src/types/job.ts | FOUND |
| worker/src/types.ts | FOUND |
| worker/src/transcript.ts | FOUND |
| worker/src/prisma.ts | FOUND |
| worker/src/index.ts | FOUND |
| worker/src/__tests__/transcript.test.ts | FOUND |
| worker/package.json | FOUND |
| migration 20260618000004 | FOUND |
| commit 93e0ab8 | FOUND |
| commit 7d6326e | FOUND |
| commit 513c894 | FOUND |
| commit 3b71c86 | FOUND |
| commit 6f1ae6d | FOUND |
