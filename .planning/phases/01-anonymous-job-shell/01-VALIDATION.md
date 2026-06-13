---
phase: 1
slug: anonymous-job-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 + React Testing Library 16.3.2 |
| **Config file** | `vitest.config.mts` — Wave 0 gap |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-T1 | 01 | 1 | SUB-01 | — | YouTube URL validated server-side before DB write | unit | `npm test -- --run src/__tests__/youtube.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-T2 | 01 | 1 | SUB-02 | — | Topic min/max length enforced by Zod schema | unit | `npm test -- --run src/__tests__/submit-job.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-T3 | 01 | 1 | SUB-05 | — | Anonymous session established before job creation | integration (manual) | Manual: open browser, submit form, check Supabase dashboard | N/A | ⬜ pending |
| 1-02-T1 | 02 | 1 | JOB-01 | — | Status page renders progress bar and status message | unit | `npm test -- --run src/__tests__/status-view.test.tsx` | ❌ W0 | ⬜ pending |
| 1-02-T2 | 02 | 1 | JOB-02 | — | Failed job shows error message and "Try again" button | unit | `npm test -- --run src/__tests__/status-view.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.mts` — Vitest configuration with React plugin and jsdom environment
- [ ] `src/__tests__/youtube.test.ts` — covers SUB-01 YouTube URL parsing (valid/invalid formats)
- [ ] `src/__tests__/submit-job.test.ts` — covers SUB-01, SUB-02 Zod schema validation
- [ ] `src/__tests__/status-view.test.tsx` — covers JOB-01, JOB-02 status rendering
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Anonymous session established before job creation | SUB-05 | Requires live Supabase connection and browser session state | Open app, submit form without account, check Supabase Auth dashboard for anonymous user entry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
