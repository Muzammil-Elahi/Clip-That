---
phase: 05-study-notes-and-pdf
reviewed: 2026-06-27T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - package.json
  - prisma/migrations/20260627233003_add_study_notes/migration.sql
  - prisma/schema.prisma
  - src/__tests__/status-view-notes-tab.test.tsx
  - src/__tests__/status-view.test.tsx
  - src/app/globals.css
  - src/app/status/page.tsx
  - src/components/StudyNotesPDFDocument.tsx
  - src/components/status-view.tsx
  - src/types/job.ts
  - worker/package.json
  - worker/src/__tests__/notesGenerator.test.ts
  - worker/src/index.ts
  - worker/src/notesGenerator.ts
findings:
  critical: 1
  warning: 4
  info: 1
  total: 6
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 05 adds AI-generated study notes (via Gemini) and a PDF download feature to the status page. The data pipeline (DB migration, Prisma schema, worker integration, client types) is consistent. The `notesSettled` state machine is correctly designed: server-rendered DONE jobs start settled, Realtime events confirm settlement, and the polling fallback mirrors both. The `dynamic(() => ..., { ssr: false })` pattern for `PDFDownloadLink` is correctly applied.

One critical bug exists: the Realtime security comment in `status-view.tsx` misdescribes the actual filter in use, which masks a real (though currently non-exploitable) architectural gap in the Realtime subscription. Four warnings cover a partial `stripMarkdown` implementation, a dirty `fileName` sanitization, a slow retry test with no fake timers, and the misleading security comment. One info item flags an unused `userId` prop on the Realtime channel.

---

## Critical Issues

### CR-01: Realtime subscription filtered on job `id` only — not scoped to `userId` as the security comment claims

**File:** `src/components/status-view.tsx:120`

**Issue:** The security comment at line 67–68 states:
> "Realtime channel filtered to userId=eq.\<uid\> — only receives events for this user's own jobs."

The actual Realtime filter at line 120 is:
```
filter: `id=eq.${initialJobId}`
```

This is scoped to job ID, **not** to `userId`. The comment is factually wrong. While the current threat surface is limited (because `initialJobId` is derived from a server-side query already gated by `user.id`), the misdescription creates a dangerous false assurance: a future developer refactoring the server component to allow passing arbitrary job IDs via query params could introduce a real IDOR/information-disclosure vulnerability via Realtime — believing the Realtime filter itself provides the userId guard, when it does not.

Supabase Realtime postgres_changes filters also do not enforce Row-Level Security by themselves in all configurations; the defense-in-depth argument depends on RLS being correctly configured on the `Job` table, which is not verified here.

**Fix:** Correct the filter to also include the `userId` condition, or update the comment to accurately reflect what the actual security boundary is:

Option A — Fix the filter (preferred):
```typescript
filter: `id=eq.${initialJobId}&userId=eq.${userId}`,
```
Note: `userId` is already available as a prop (`StatusViewProps.userId`, line 51). Supabase Realtime accepts compound filters using `&` between clauses.

Option B — Fix the comment to be accurate:
```typescript
// Security: channel scoped to this job's id. The userId guard is enforced
// server-side (status/page.tsx queries by userId) and by RLS on the Job table.
// Realtime filter is job-id only — NOT userId-scoped at the subscription level.
filter: `id=eq.${initialJobId}`,
```

---

## Warnings

### WR-01: `stripMarkdown` does not handle ordered lists or Markdown links — both render literally in the PDF

**File:** `src/components/StudyNotesPDFDocument.tsx:30-38`

**Issue:** The `stripMarkdown` function handles headings, bold, italic, unordered list bullets, and backtick code spans. It does not handle:

- **Ordered lists:** `1. Item` → `1. Item` appears verbatim in the PDF body.
- **Markdown links:** `[link text](https://...)` → rendered literally as `[link text](https://...)`.
- **Horizontal rules:** `---` → rendered literally.

The Gemini prompt instructs the model to use `##` and `-` bullets only, but Gemini output is non-deterministic and can produce ordered lists, links, or `---` separators — especially for "Definitions" sections. If the model uses `1.` for a numbered definition list or includes a source link, the raw Markdown syntax leaks into the PDF.

**Fix:**
```typescript
function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')                 // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')            // bold
    .replace(/\*(.+?)\*/g, '$1')                // italic
    .replace(/^[-*]\s+/gm, '• ')               // unordered list bullets
    .replace(/^\d+\.\s+/gm, '')                 // ordered list numbers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // links → link text only
    .replace(/^---+$/gm, '')                    // horizontal rules
    .replace(/`{1,3}/g, '')                     // code ticks
    .trim()
}
```

---

### WR-02: PDF `fileName` not sanitized for characters invalid in filenames

**File:** `src/components/status-view.tsx:308`

**Issue:** The PDF download filename is constructed as:
```typescript
fileName={`study-notes-${topic.toLowerCase().replace(/\s+/g, '-')}.pdf`}
```

This only replaces whitespace with hyphens. If `topic` contains characters that are invalid in filenames on Windows or macOS/Linux (e.g., `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, `#`), the resulting filename will be problematic. Examples:

- Topic `"C++: Why/How"` → filename `study-notes-c++:-why/how.pdf`
- Topic `"React <Hooks>"` → filename `study-notes-react-<hooks>.pdf`

Some browsers silently strip or mangle invalid characters; others (especially Windows) produce a download error or save with an unexpected name.

**Fix:**
```typescript
fileName={`study-notes-${
  topic
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '')   // strip all non-word, non-hyphen characters
}.pdf`}
```

---

### WR-03: Retry test executes a real 2-second `sleep()` — no fake timers configured

**File:** `worker/src/__tests__/notesGenerator.test.ts:51-59`

**Issue:** The test "retry — returns string when first call throws but second resolves" exercises the retry path in `generateStudyNotes`. The production code path at `notesGenerator.ts:61` calls `await sleep(2000)` between attempts. No fake timers are set up in the test file or in `worker/vitest.config.ts`, so this test waits a full 2 real seconds every time it runs.

This is not a correctness bug, but it means the worker test suite is artificially slow and the delay will compound if more retry tests are added.

**Fix:** Use `vi.useFakeTimers()` to advance time without waiting:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('generateStudyNotes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // ...
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.GEMINI_API_KEY
  })

  it('retry — returns string when first call throws but second resolves', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('Transient error'))
      .mockResolvedValueOnce({ text: '## Key Points\nA, B' })

    const promise = generateStudyNotes(entries, 'photosynthesis')
    await vi.runAllTimersAsync()   // advance the 2s sleep instantly
    const result = await promise

    expect(result).not.toBeNull()
  })
})
```

---

### WR-04: Misleading security comment claims Realtime is scoped to `userId` (secondary to CR-01)

**File:** `src/components/status-view.tsx:67-70`

**Issue:** The JSDoc block states:
> "Security (T-03-01): Realtime channel filtered to userId=eq.\<uid\> — only receives events for this user's own jobs."

As established in CR-01, the actual filter is `id=eq.${initialJobId}`. This comment will mislead future reviewers and developers into believing userId-level filtering is present at the Realtime layer when it is not. Even if CR-01's filter is fixed to include userId, the comment currently creates an audit trail mismatch (the comment is wrong in the submitted code, before any fix).

**Fix:** Update the comment before or as part of the CR-01 fix to accurately describe the filtering chain:
```typescript
// Security (T-03-01): Realtime channel scoped by job id AND userId — only
// receives UPDATE events for this specific job row. Server-side userId guard
// (status/page.tsx) + RLS on Job table provide defense in depth.
```

---

## Info

### IN-01: `userId` prop is threaded into `StatusView` but used only in the Realtime comment, not in the subscription filter

**File:** `src/components/status-view.tsx:51, 75, 78`

**Issue:** `userId` is declared in `StatusViewProps` (line 51), accepted as a prop (line 78), but the only thing it is used for is the Realtime subscription — where it is, per CR-01, **not** actually included in the filter. The prop value is not referenced anywhere in the component body; it appears in `status/page.tsx` as `userId={user.id}` (line 59) and is passed through, but has no runtime effect.

If CR-01 is fixed by adding `userId` to the Realtime filter, this prop becomes genuinely used. If CR-01 is resolved by only fixing the comment (Option B), `userId` becomes dead code and should be removed to avoid confusion.

**Fix:** After resolving CR-01, either:
- Use the prop in the Realtime filter (Option A), or
- Remove the prop from `StatusViewProps`, the component signature, and the call in `status/page.tsx`.

---

_Reviewed: 2026-06-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
