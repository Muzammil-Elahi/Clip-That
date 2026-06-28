---
phase: 06
slug: optional-semantic-matching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already installed in worker/) |
| **Config file** | worker/vitest.config.ts |
| **Quick run command** | `cd worker && npm test -- --reporter=verbose` |
| **Full suite command** | `cd worker && npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npm test -- --reporter=verbose`
- **After every plan wave:** Run `cd worker && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | MAT-02 | — | N/A | unit | `cd worker && npm test -- semanticMatcher` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | MAT-03 | — | Exact matches never removed by dedup | unit | `cd worker && npm test -- semanticMatcher` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | MAT-02 | — | Soft-fail: job completes on API error | unit | `cd worker && npm test -- semanticMatcher` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | MAT-04 | — | matchType and confidence fields present | unit | `cd worker && npm test -- semanticMatcher` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | SUB-04 | — | semanticEnabled defaults false | unit | `cd worker && npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `worker/src/__tests__/semanticMatcher.test.ts` — stubs for MAT-02, MAT-03, MAT-04
- [ ] Vitest mock for `@google/genai` embedContent — needed for offline unit tests

*Existing Vitest infrastructure covers the framework requirement. Only test files need adding.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Checkbox appears below topic field | SUB-04 | UI rendering | Open submission form, verify checkbox "Also find related references" is below topic field |
| Semantic matches labeled differently in transcript | MAT-03 | UI rendering | Submit job with semantic enabled, verify "Semantic match" label visible on related segments |
| Soft-fail: job delivers exact results when Gemini is down | MAT-02 | Requires Gemini API outage simulation | Revoke GEMINI_API_KEY, submit job with semanticEnabled, confirm DONE status with exact matches only |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
