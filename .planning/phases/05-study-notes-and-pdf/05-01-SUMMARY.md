---
phase: 05-study-notes-and-pdf
plan: 01
subsystem: api
tags: [gemini, ai, google-genai, prisma, vitest, tdd, worker, study-notes]

# Dependency graph
requires:
  - phase: 03-context-clip-plan-and-stitched-transcript
    provides: buildStitchedTranscript() producing StitchedTranscriptEntry[] used as note generation input
  - phase: 04-stitched-video-output
    provides: worker pipeline pattern (module per step, soft-fail, DONE update payload)
provides:
  - generateStudyNotes(entries, topic) — Gemini 2.0 Flash text generation with soft-fail and 1-retry
  - studyNotes String? column on Job model with migration
  - notesGenerator.ts module following established worker module pattern
  - studyNotes persisted to DONE update payload in processPendingJob()
affects:
  - 05-02-study-notes-and-pdf (Notes UI tab and PDF download depend on studyNotes from this plan)
  - prisma/schema.prisma (studyNotes column now in schema and generated client)

# Tech tracking
tech-stack:
  added:
    - "@google/genai@2.10.0 (worker) — official Google Gemini SDK, replaces deprecated @google/generative-ai"
  patterns:
    - "Worker module pattern: single exported async function, soft-fail return string | null, .js ESM imports"
    - "Soft-fail pattern: missing env var returns null (not throws), 1 retry with 2s sleep before null"
    - "TDD pattern: RED (test only, imports fail) → GREEN (implementation, all pass) with separate commits"
    - "Prisma Text? column: pass string | null directly to update payload (no Prisma.InputJsonValue cast)"
    - "Manual migration file creation when DIRECT_URL unavailable in worktree environment"

key-files:
  created:
    - worker/src/notesGenerator.ts
    - worker/src/__tests__/notesGenerator.test.ts
    - prisma/migrations/20260627233003_add_study_notes/migration.sql
  modified:
    - prisma/schema.prisma
    - worker/src/index.ts
    - worker/package.json

key-decisions:
  - "Use @google/genai (not @google/generative-ai) — new official SDK; old SDK frozen at v0.x without Gemini 2.0+ support"
  - "Model: gemini-3-flash per RESEARCH.md open question resolution (gemini-1.5-flash and gemini-2.0-flash are deprecated/shut down)"
  - "Soft-fail only: missing GEMINI_API_KEY returns null (not process.exit(1)); consistent with D-09/D-10"
  - "Migration created manually (not via prisma migrate dev) because DIRECT_URL env var not available in worktree"
  - "TDD RED: used function constructor (not arrow function) in vi.mock for GoogleGenAI so new GoogleGenAI() works"

patterns-established:
  - "notesGenerator.ts: module-level ai client + sleep helper + GEMINI_API_KEY guard + retry loop for 0..1 attempts"
  - "Worker pipeline insertion: console.log phase header, await step, conditional log for soft-fail, never throw"
  - "vi.mock for class constructors: use function MockClass() { return {...} } not vi.fn().mockImplementation(() => {})"

requirements-completed: [NOT-01, NOT-02, NOT-03, NOT-04]

# Metrics
duration: 6min
completed: 2026-06-27
---

# Phase 05 Plan 01: Study Notes and PDF Summary

**Gemini note generation worker module with @google/genai, 1-retry soft-fail, studyNotes Text? Prisma migration, wired into processPendingJob() before DONE update**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-27T23:27:51Z
- **Completed:** 2026-06-27T23:34:09Z
- **Tasks:** 3 (TDD RED + GREEN + pipeline wiring)
- **Files modified:** 6

## Accomplishments

- Created `worker/src/notesGenerator.ts` exporting `generateStudyNotes(entries, topic): Promise<string | null>` using `@google/genai` with `gemini-3-flash` model
- Added `studyNotes String?` to `prisma/schema.prisma` with migration file and regenerated Prisma client
- Wired note generation into `processPendingJob()` after `buildStitchedTranscript()`, before DONE update — `studyNotes` persisted to Job row
- All 4 unit tests (happy path, soft-fail, retry, missing key) pass GREEN; full worker suite: 64 tests across 10 files

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 - notesGenerator test scaffold (RED)** - `04c3e99` (test)
2. **Task 2: Prisma schema + migration + notesGenerator implementation (GREEN)** - `a2c37b8` (feat)
3. **Task 3: Wire generateStudyNotes into worker pipeline** - `1f98f14` (feat)

_Note: TDD tasks have separate RED and GREEN commits_

## Files Created/Modified

- `worker/src/notesGenerator.ts` — exports `generateStudyNotes()` with @google/genai, gemini-3-flash, soft-fail + 1 retry
- `worker/src/__tests__/notesGenerator.test.ts` — 4 unit tests: happy path, soft-fail, retry, missing GEMINI_API_KEY
- `prisma/migrations/20260627233003_add_study_notes/migration.sql` — `ALTER TABLE "Job" ADD COLUMN "studyNotes" TEXT`
- `prisma/schema.prisma` — added `studyNotes String?` after videoExpiresAt
- `worker/src/index.ts` — import + call site after buildStitchedTranscript + studyNotes in DONE update payload
- `worker/package.json` — added `@google/genai@^2.10.0` dependency

## Decisions Made

- Used `@google/genai` (not `@google/generative-ai`) per RESEARCH.md — old SDK frozen, no Gemini 2.x support
- Model string `gemini-3-flash` per RESEARCH.md open question resolution (user-approved 2026-06-26); `gemini-2.5-flash` and `gemini-1.5-flash` are deprecated
- Missing `GEMINI_API_KEY` is a soft-fail (returns null, logs warning) not fatal — consistent with D-09
- Migration file created manually since `DIRECT_URL` is not available in worktree environments; matches the established pattern from Phase 4 verification notes (user must run `npx prisma migrate deploy` with their DIRECT_URL)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock constructor for GoogleGenAI class**
- **Found during:** Task 2 (GREEN phase — running tests)
- **Issue:** `vi.fn().mockImplementation(() => ({ models: {...} }))` produces an arrow function, which cannot be used as a constructor with `new`. This caused `TypeError: () => ({ ... }) is not a constructor` when `notesGenerator.ts` initialized `const ai = new GoogleGenAI(...)` at module level.
- **Fix:** Changed to `function MockGoogleGenAI() { return { models: { generateContent: mockGenerateContent } } }` in the `vi.mock` factory
- **Files modified:** `worker/src/__tests__/notesGenerator.test.ts`
- **Verification:** All 4 tests pass GREEN
- **Committed in:** `a2c37b8` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required fix for test to function. No scope change.

## Issues Encountered

- `prisma migrate dev --name add_study_notes` failed with `PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL` — worktree environment does not have `.env.local` access for the `DIRECT_URL` variable. Migration file was created manually following the exact same structure as `20260626000001_add_video_url_expires_at/migration.sql`. User must apply this migration with `npx prisma migrate deploy` or `npx prisma migrate dev` from their terminal where `DIRECT_URL` is available.

## User Setup Required

Before the worker can generate notes in production:

1. Add `GEMINI_API_KEY` to `worker/.env.local` and Railway environment variables (get from Google AI Studio)
2. Apply the Prisma migration: run `npx prisma migrate dev` or `npx prisma migrate deploy` from project root with `DIRECT_URL` set
3. The Prisma client has already been regenerated locally (`npm run build` in worker/) — Railway will run this on deploy

Note: If `GEMINI_API_KEY` is absent, the worker soft-fails gracefully — `studyNotes = null`, job still reaches `DONE`. Video and transcript remain accessible.

## Next Phase Readiness

- Plan 01 complete — `studyNotes` is generated by the worker and persisted on the Job row
- Plan 02 (Notes UI + PDF) can proceed: reads `studyNotes` from Supabase Realtime, renders with `react-markdown`, adds PDF download via `@react-pdf/renderer`
- No blockers for Plan 02 development (migration can be applied by user before testing end-to-end)

---
*Phase: 05-study-notes-and-pdf*
*Completed: 2026-06-27*
