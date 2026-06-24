---
phase: 3
slug: context-clip-plan-and-stitched-transcript
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.8 |
| **Config file (worker)** | `worker/vitest.config.ts` — environment: node |
| **Config file (frontend)** | `vitest.config.ts` — environment: jsdom |
| **Quick run command (worker)** | `cd worker && npm run test:run` |
| **Quick run command (frontend)** | `npm run test:run` |
| **Full suite command** | `npm run test:run && cd worker && npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npm run test:run` (worker tasks) or `npm run test:run` (frontend tasks)
- **After every plan wave:** Run `npm run test:run && cd worker && npm run test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CLP-02 | — | N/A | unit | `cd worker && npm run test:run -- contextExpander` | ❌ Wave 0 | ⬜ pending |
| 03-01-02 | 01 | 1 | CLP-02 | — | N/A | unit | `cd worker && npm run test:run -- contextExpander` | ❌ Wave 0 | ⬜ pending |
| 03-01-03 | 01 | 1 | CLP-03 | — | N/A | unit | `cd worker && npm run test:run -- contextExpander` | ❌ Wave 0 | ⬜ pending |
| 03-01-04 | 01 | 1 | CLP-04, STR-01 | — | N/A | unit | `cd worker && npm run test:run -- stitchedTranscript` | ❌ Wave 0 | ⬜ pending |
| 03-02-01 | 02 | 2 | STR-01 | T-03-01 | stitchedTranscript scoped to userId | unit | `cd worker && npm run test:run -- stitchedTranscript` | ❌ Wave 0 | ⬜ pending |
| 03-02-02 | 02 | 2 | STR-02, STR-03 | — | N/A | unit | `npm run test:run -- status-view` | ❌ needs update | ⬜ pending |
| 03-02-03 | 02 | 2 | STR-02 | — | N/A | unit | `npm run test:run -- status-view` | ❌ needs update | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `worker/src/__tests__/contextExpander.test.ts` — stubs for CLP-02 (expansion + edge truncation) and CLP-03 (overlap merge)
- [ ] `worker/src/__tests__/stitchedTranscript.test.ts` — stubs for CLP-04, STR-01 (entry generation + empty plan)
- [ ] `src/__tests__/status-view.test.tsx` — existing file needs new test cases for DONE+transcript, DONE+empty state, tab rendering (STR-02, STR-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prisma migration applied to Supabase | CLP-04 | Requires live DB connection | Run `npx prisma migrate dev --name add-stitched-transcript` and verify `Job` table has `stitchedTranscript` column in Supabase dashboard |
| Transcript tab visible on result page after job completes | STR-02 | Full E2E browser flow | Submit a job, wait for DONE, verify Transcript tab shows entries with `[M:SS]` timestamps |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
