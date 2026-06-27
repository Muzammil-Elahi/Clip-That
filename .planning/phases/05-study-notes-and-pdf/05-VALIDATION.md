---
phase: 05
slug: study-notes-and-pdf
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4.1.8 (frontend) + Vitest v4.1.8 (worker) |
| **Config file** | `vitest.config.mts` (frontend, jsdom env) / `worker/vitest.config.ts` (worker, node env) |
| **Quick run command** | `npm run test:run` (root) and `cd worker && npm run test:run` |
| **Full suite command** | `npm run test:run && cd worker && npm run test:run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run` and `cd worker && npm run test:run`
- **After every plan wave:** Both test suites must pass fully
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-W0 | 01 | 0 | NOT-01 | — | N/A | unit stub | `cd worker && npm run test:run -- src/__tests__/notesGenerator.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-01 | 01 | 1 | NOT-01 | T-05-01 | GEMINI_API_KEY in worker env only | unit | `cd worker && npm run test:run -- src/__tests__/notesGenerator.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | NOT-01 | — | generateStudyNotes returns null on API failure | unit | same | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | NOT-01 | — | generateStudyNotes retries once before null | unit | same | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | NOT-02/03/04 | — | Gemini prompt includes topic and transcript | unit (mock) | same | ❌ W0 | ⬜ pending |
| 05-02-W0 | 02 | 0 | NOT-05 | — | N/A | RTL stub | `npm run test:run -- src/__tests__/status-view-notes-tab.test.tsx` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | NOT-05 | — | Download PDF button visible when notes available | unit (RTL) | `npm run test:run -- src/__tests__/status-view-notes-tab.test.tsx` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | NOT-05 | — | Loading state shown while notesSettled=false | unit (RTL) | same | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 2 | NOT-05 | — | Soft-fail state shown when notesSettled=true && studyNotes=null | unit (RTL) | same | ❌ W0 | ⬜ pending |
| regression | 01+02 | all | all | — | Existing tests pass (no regression) | regression | `npm run test:run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `worker/src/__tests__/notesGenerator.test.ts` — stubs for NOT-01 (generateStudyNotes happy path, soft-fail, retry)
- [ ] `src/__tests__/status-view-notes-tab.test.tsx` — stubs for NOT-05 (Notes tab three-state rendering: loading, notes available, soft-fail)
- [ ] Mock for `@react-pdf/renderer` in RTL test environment (jsdom does not support PDF canvas APIs)

```typescript
// In src/__tests__/status-view-notes-tab.test.tsx
vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }: any) => <>{children({ loading: false })}</>,
  Document: ({ children }: any) => <>{children}</>,
  Page: ({ children }: any) => <>{children}</>,
  View: ({ children }: any) => <>{children}</>,
  Text: ({ children }: any) => <>{children}</>,
  StyleSheet: { create: (s: any) => s },
}))
```

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF renders correctly in browser with proper formatting | NOT-05 | `@react-pdf/renderer` generates binary PDF — no jsdom assertion possible | Open a job status page, click "Download PDF", verify PDF contains notes content with headings and body text |
| Notes contain explanation, key points, and definitions | NOT-02/03/04 | LLM output quality — not deterministic | Review generated notes for 3+ real clips; verify structure includes key concepts from transcript |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
