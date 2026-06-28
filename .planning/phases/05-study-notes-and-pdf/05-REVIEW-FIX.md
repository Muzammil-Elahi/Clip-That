---
phase: 05-study-notes-and-pdf
fixed_at: 2026-06-27T00:00:00Z
review_path: .planning/phases/05-study-notes-and-pdf/05-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-06-27T00:00:00Z
**Source review:** .planning/phases/05-study-notes-and-pdf/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0

Note: IN-01 was excluded from scope per `fix_scope: critical_warning`. WR-04 (misleading comment) was fixed atomically with CR-01 (filter fix) since both changes are in the same file and are tightly coupled.

## Fixed Issues

### CR-01 + WR-04: Realtime subscription filtered on job `id` only — not scoped to `userId` as the security comment claims

**Files modified:** `src/components/status-view.tsx`
**Commit:** `cafbd0c`
**Applied fix:** Added `&userId=eq.${userId}` to the Realtime filter (Option A — preferred), making the subscription genuinely scoped to both job id and user id. Updated the JSDoc security comment (T-03-01) to accurately describe the compound filter and the defense-in-depth chain (server-side guard + RLS + Realtime filter). Also added `userId` to the `useEffect` dependency array since it is now referenced inside the effect.

---

### WR-01: `stripMarkdown` does not handle ordered lists or Markdown links — both render literally in the PDF

**Files modified:** `src/components/StudyNotesPDFDocument.tsx`
**Commit:** `ca357c0`
**Applied fix:** Added three new `.replace()` chains to `stripMarkdown`:
- `^\d+\.\s+` (multiline) — strips ordered list numbers (`1. item` → `item`)
- `\[([^\]]+)\]\([^)]+\)` — strips Markdown links, preserving link text (`[text](url)` → `text`)
- `^---+$` (multiline) — removes horizontal rules

---

### WR-02: PDF `fileName` not sanitized for characters invalid in filenames

**Files modified:** `src/components/status-view.tsx`
**Commit:** `0723fd6`
**Applied fix:** Added `.replace(/[^\w\-]/g, '')` after the whitespace-to-hyphen replacement in the `fileName` prop. This strips all characters that are not word characters (`[a-zA-Z0-9_]`) or hyphens, eliminating `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, `+`, `#`, and other problematic characters before they reach the filename.

---

### WR-03: Retry test executes a real 2-second `sleep()` — no fake timers configured

**Files modified:** `worker/src/__tests__/notesGenerator.test.ts`
**Commit:** `d581ad4`
**Applied fix:** Added `vi.useFakeTimers()` in `beforeEach` and `vi.useRealTimers()` in `afterEach`. Updated the retry test and the soft-fail test (which also hits the 2s sleep path) to use the async pattern: start the promise, call `await vi.runAllTimersAsync()` to advance the sleep instantly, then await the result. The happy path and missing-key tests are unaffected since they complete before reaching the sleep.

---

_Fixed: 2026-06-27T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
