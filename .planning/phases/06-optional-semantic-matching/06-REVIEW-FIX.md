---
phase: 06-optional-semantic-matching
fixed_at: 2026-06-28T12:37:00Z
review_path: .planning/phases/06-optional-semantic-matching/06-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-06-28T12:37:00Z
**Source review:** .planning/phases/06-optional-semantic-matching/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, WR-01, WR-02, WR-03, WR-04, WR-05)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01/WR-02: cosineSimilarity throws on length mismatch; assertValidEmbedding throws on dimension != 768

**Files modified:** `worker/src/semanticMatcher.ts`
**Commit:** 2ac5c01
**Applied fix:** Added a `if (a.length !== b.length) throw new Error(...)` guard at the top of `cosineSimilarity`. Changed the `console.warn` in `assertValidEmbedding` for dimension != 768 to `throw new Error(...)`. These were handled in a single atomic commit since both changes address the same root defect (mismatched vectors silently reaching the similarity computation).

---

### WR-01: 429 detection also checks RESOURCE_EXHAUSTED

**Files modified:** `worker/src/semanticMatcher.ts`
**Commit:** 1567b70
**Applied fix:** Changed `is429` detection from a single `err.message.includes('429')` check to an OR condition that also matches `err.message.includes('RESOURCE_EXHAUSTED')`, covering the SDK's gRPC-style error text for rate-limit responses.

---

### WR-03: Lazy-construct GoogleGenAI inside findSemanticMatches after API key guard

**Files modified:** `worker/src/semanticMatcher.ts`
**Commit:** 2ec8537
**Applied fix:** Removed the module-level `const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })`. Added `const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })` inside `findSemanticMatches` immediately after the key guard (so it only runs when a valid key is present). Updated `batchEmbed` and `embedWithRetry` signatures to accept `ai: GoogleGenAI` as the first parameter, forwarding it through the call chain.

---

### WR-04: embedWithRetry retries 503, 500, and UNAVAILABLE in addition to 429

**Files modified:** `worker/src/semanticMatcher.ts`
**Commit:** a0a5b41
**Applied fix:** Renamed `is429` to `isRetryable` and extended the OR condition to also match `err.message.includes('503')`, `err.message.includes('500')`, and `err.message.includes('UNAVAILABLE')`. Updated the `console.warn` message from "429 — retrying" to "transient error — retrying" to reflect the broadened scope.

---

### WR-05: semantic-eval-dataset.json annotated as future evaluation fixture

**Files modified:** `worker/src/__tests__/fixtures/semantic-eval-dataset.json`
**Commit:** ab53794
**Applied fix:** Restructured the flat JSON array into an object with a `_comment` field and a `cases` array. The `_comment` field explains the file is a deferred evaluation dataset not yet consumed by any test, intended for future threshold calibration work. All 12 cases are preserved unchanged under the `cases` key.

---

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-06-28T12:37:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
