---
phase: 02
slug: transcript-and-exact-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.mts` (project root) / `worker/vitest.config.ts` (worker) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run`
- **After every plan wave:** Run `npm run test:run` (all tests green)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-* | 01 | 1 | TRN-01, TRN-02 | — | N/A | unit | `npm run test:run` | ❌ W0 | ⬜ pending |
| 02-02-* | 02 | 2 | TRN-03, MAT-01, CLP-01 | — | N/A | unit | `npm run test:run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `worker/src/__tests__/transcript.test.ts` — stubs for TRN-01, TRN-02 (mock `youtube-transcript-plus`)
- [ ] `worker/src/__tests__/matcher.test.ts` — stubs for TRN-03, MAT-01, CLP-01
- [ ] `worker/vitest.config.ts` — Vitest config for the worker package
- [ ] `worker/package.json` — worker package with `test` script pointing to worker Vitest

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Worker picks up PENDING job from Supabase | SUB-03 | Requires live Supabase + Railway | Submit a job, start worker, confirm status transitions PENDING → PROCESSING → DONE in dashboard |
| Prisma migration runs cleanly | TRN-01 | Requires live DB connection | `npx prisma migrate dev --name add-transcript-clip-plan`, confirm `transcript` + `clipPlan` columns in Supabase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
