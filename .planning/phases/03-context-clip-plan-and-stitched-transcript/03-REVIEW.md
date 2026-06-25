---
phase: "03-context-clip-plan-and-stitched-transcript"
reviewed: 2026-06-24T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - worker/src/contextExpander.ts
  - worker/src/stitchedTranscript.ts
  - worker/src/__tests__/contextExpander.test.ts
  - worker/src/__tests__/stitchedTranscript.test.ts
  - worker/src/types.ts
  - worker/src/index.ts
  - prisma/schema.prisma
  - src/components/ui/tabs.tsx
  - src/types/job.ts
  - src/components/status-view.tsx
  - src/app/status/page.tsx
  - src/__tests__/status-view.test.tsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 03 added context expansion (`contextExpander.ts`), overlap merging, stitched transcript generation (`stitchedTranscript.ts`), and the corresponding frontend tab UI in `status-view.tsx`. The implementation is generally well-structured — the pure-function split across modules is clean, XSS threat T-03-06/T-03-07 is correctly mitigated via JSX text nodes, and RLS+getUser() security properties are preserved.

Three correctness bugs were found that produce crashes or permanently stuck database state at runtime. Four warnings cover a runtime type-safety gap in the Prisma JSON cast, spec deviation in Video/Notes tab copy, a subtle `startIdx` inconsistency in overlap merging, and a test mock mismatch that hides Realtime cleanup bugs. Three info items cover low-risk naming, key stability, and test coverage gaps.

## Critical Issues

### CR-01: `Math.min(...[])` panics when a ClipMatch has an empty `segmentIndices` array

**File:** `worker/src/contextExpander.ts:33-34`
**Issue:** `expandContextWindows` spreads `match.segmentIndices` directly into `Math.min` and `Math.max`:

```ts
const innerStart = Math.min(...match.segmentIndices)
const innerEnd   = Math.max(...match.segmentIndices)
```

When `match.segmentIndices` is an empty array, `Math.min()` returns `Infinity` and `Math.max()` returns `-Infinity`. These values are then used as array indices: `segments[Infinity]` is `undefined`, and the subsequent `Math.round(segments[leftIdx].offset * 1000)` at line 55 throws `TypeError: Cannot read properties of undefined`. This crash propagates to the `catch` block in `index.ts`, marking the job `FAILED` instead of `DONE`.

The `ClipMatch` interface declares `segmentIndices: number[]` with no non-empty constraint. The matcher today always produces non-empty arrays, but the type contract does not enforce this, and tests do not cover this edge case.

**Fix:**
```ts
// At the top of the .map() callback in expandContextWindows:
if (match.segmentIndices.length === 0) return null

// Then filter nulls from the result:
return matches
  .map(match => {
    if (match.segmentIndices.length === 0) return null
    // ... existing logic ...
  })
  .filter((w): w is ExpandedWindow => w !== null)
```

Add a test:
```ts
it('skips ClipMatch with empty segmentIndices without throwing', () => {
  const segments = [{ text: 'a', offset: 0, duration: 5, lang: 'en' }]
  const matches = [{ startMs: 0, endMs: 5000, text: 'a', segmentIndices: [] }]
  expect(() => expandContextWindows(segments, matches)).not.toThrow()
  expect(expandContextWindows(segments, matches)).toEqual([])
})
```

---

### CR-02: `expandContextWindows` panics on empty `segments` array when matches are non-empty

**File:** `worker/src/contextExpander.ts:55-56`
**Issue:** When `segments` is empty but `matches` is non-empty, the while-loops do not execute (because `leftIdx > 0` is false for index 0 and `rightIdx < segments.length - 1` is false for `-1`). The return statement at lines 55-56 then dereferences `segments[0]` which is `undefined`:

```ts
startMs: Math.round(segments[leftIdx].offset * 1000),  // segments[0] is undefined → crash
endMs: Math.round((segments[rightIdx].offset + segments[rightIdx].duration) * 1000),
```

In production the worker flow prevents this (no segments means `fetchTranscript` returned nothing, and `buildClipPlan` would return no matches). However, the function has no documented precondition and its type signature allows `segments: TranscriptSegment[]` with `matches: ClipMatch[]` independently. The function is inconsistent with `mergeOverlappingWindows`, which already has an early-return guard for empty input.

**Fix:**
```ts
export function expandContextWindows(
  segments: TranscriptSegment[],
  matches: ClipMatch[],
  contextMs = CONTEXT_WINDOW_MS,
): ExpandedWindow[] {
  if (segments.length === 0) return []   // add this guard
  return matches.map(match => {
    // ... existing logic ...
  })
}
```

---

### CR-03: Worker sets `processingJob = true` after marking job PROCESSING in DB, leaving SIGTERM gap

**File:** `worker/src/index.ts:47-52`
**Issue:** The graceful shutdown handler waits for `processingJob` to become false before closing the database connection. However, `processingJob` is only set to `true` at line 52, *after* the job has already been written as `PROCESSING` in the database at lines 47-50:

```ts
await prisma.job.update({
  where: { id: job.id },
  data: { status: 'PROCESSING' },
})
// SIGTERM window: processingJob is still false here —
// shutdown handler can exit without waiting
processingJob = true   // line 52
try { ... }
```

If SIGTERM arrives in this window (between the `update` and the flag), the shutdown handler finds `processingJob === false`, closes the database connection immediately, and exits. The job is left permanently stuck in `PROCESSING` status. On next worker restart, the query at line 43 only picks up `PENDING` jobs — the stuck `PROCESSING` job is never retried.

Phase 03 widens this window further: context expansion and stitched transcript generation are now also performed between flag-set and job completion, increasing the time the worker is doing meaningful work while `processingJob` could still be incorrectly false.

**Fix:**
```ts
processingJob = true   // set flag BEFORE writing PROCESSING to DB
await prisma.job.update({
  where: { id: job.id },
  data: { status: 'PROCESSING' },
})
try {
  // ... all existing work ...
} catch (err) {
  // ...
} finally {
  processingJob = false
}
```

Also consider adding a startup recovery step that resets any jobs stuck in `PROCESSING` back to `PENDING`.

---

## Warnings

### WR-01: Unsafe runtime cast of `stitchedTranscript` JSON from Prisma lacks shape validation

**File:** `src/app/status/page.tsx:63`
**Issue:** The Prisma `Job.stitchedTranscript` column is typed `Json | null` — at runtime this can be any JSON value (string, number, boolean, object, array, null). The cast:

```ts
initialStitchedTranscript={(job.stitchedTranscript as StitchedTranscriptEntry[] | null) ?? null}
```

is a TypeScript-only type assertion with no runtime shape check. If the database contains a malformed, migrated, or legacy value, the component receives unexpected data. In `status-view.tsx` the render path calls `entry.sourceStartMs` inside `formatTimestamp(entry.sourceStartMs)` — if `entry` is not an object with that field, the rendered output is `[NaN:NaN]` or throws entirely. The same cast is applied inside `status-view.tsx` at line 135 from the Supabase polling fallback.

**Fix:**
```ts
// lib/parseStitchedTranscript.ts (new utility, or inline)
function toStitchedTranscript(raw: unknown): StitchedTranscriptEntry[] | null {
  if (!Array.isArray(raw)) return null
  return raw.filter(
    (e): e is StitchedTranscriptEntry =>
      typeof e === 'object' && e !== null &&
      typeof (e as Record<string, unknown>).sourceStartMs === 'number' &&
      typeof (e as Record<string, unknown>).sourceEndMs === 'number' &&
      typeof (e as Record<string, unknown>).text === 'string'
  )
}

// In status/page.tsx line 63:
initialStitchedTranscript={toStitchedTranscript(job.stitchedTranscript)}
```

Apply the same guard in `status-view.tsx` line 135 for the polling fallback result.

---

### WR-02: Video and Notes tab copy not in spec; conditional logic adds unspecified messages

**File:** `src/components/status-view.tsx:231-261`
**Issue:** The plan and UI-SPEC define fixed copy for Video and Notes tabs:
- Video: `"Video clips will be available here once processing is complete."`
- Notes: `"Study notes will appear here in a future update."`

The implementation wraps these in a conditional based on `stitchedTranscript?.length`:

```tsx
{(stitchedTranscript?.length ?? 0) === 0
  ? `No mentions of "${topic}" were found in this video, so there are no video clips to show.`
  : 'Video clips will be available here once processing is complete.'}
```

The empty-case strings are not in the UI-SPEC — they are invented copy. No test covers the Video or Notes tab content under any condition, so this divergence from spec is completely invisible to the test suite. The Transcript tab correctly uses the spec-defined empty-state message; Video and Notes should match their spec messages unconditionally (or only show the Transcript tab empty message).

**Fix:**
```tsx
<TabsContent value="video">
  <p className="text-base text-muted-foreground">
    Video clips will be available here once processing is complete.
  </p>
</TabsContent>
<TabsContent value="notes">
  <p className="text-base text-muted-foreground">
    Study notes will appear here in a future update.
  </p>
</TabsContent>
```

Add test cases asserting these strings are present when `initialStatus="DONE"`.

---

### WR-03: `mergeOverlappingWindows` always takes `startIdx` from the first window, not necessarily the minimum

**File:** `worker/src/contextExpander.ts:77-82`
**Issue:** When merging overlapping windows, the implementation picks `startIdx` from `last` (the first window in `startMs` order):

```ts
merged[merged.length - 1] = {
  startIdx: last.startIdx,    // always taken from 'last' — not necessarily Math.min
  endIdx: Math.max(last.endIdx, curr.endIdx),
  startMs: last.startMs,
  endMs: Math.max(last.endMs, curr.endMs),
}
```

This is safe under the assumption that `startMs` order corresponds to `startIdx` order. That holds for windows produced by `expandContextWindows` (because segments are processed in ascending index order). However, `ExpandedWindow`'s fields `startMs` and `startIdx` are independent — `mergeOverlappingWindows` accepts any `ExpandedWindow[]` input. If a caller provides windows where `startMs` order differs from `startIdx` order (e.g., floating-point rounding at segment boundaries), the merged window gets an incorrect `startIdx`. `buildStitchedTranscript` iterates `for (let i = window.startIdx; i <= window.endIdx; i++)`, so a wrong `startIdx` silently includes wrong transcript segments.

**Fix:**
```ts
merged[merged.length - 1] = {
  startIdx: Math.min(last.startIdx, curr.startIdx),  // take minimum, not always 'last'
  endIdx: Math.max(last.endIdx, curr.endIdx),
  startMs: last.startMs,
  endMs: Math.max(last.endMs, curr.endMs),
}
```

Add a test that verifies correct `startIdx` selection when input windows have `startMs` order differing from `startIdx` order.

---

### WR-04: Supabase client mock does not match actual channel chaining; cleanup code is never exercised in tests

**File:** `src/__tests__/status-view.test.tsx:29-38`
**Issue:** The mock:

```ts
createClient: () => ({
  channel: () => ({
    on: () => ({
      subscribe: vi.fn(),
    }),
  }),
  removeChannel: vi.fn(),
})
```

The actual Supabase client chains as: `supabase.channel(...).on(...).subscribe()` where `subscribe()` returns the channel object, and then `supabase.removeChannel(channel)` is called with that returned channel. In the mock, `subscribe()` returns `vi.fn()` (not the channel), so the cleanup call becomes `supabase.removeChannel(vi.fn())` — it calls `removeChannel` on the wrong reference but against the top-level mock which has `removeChannel: vi.fn()`, so it happens to not throw. The effect: cleanup code runs silently without error but `removeChannel` is called with a wrong argument, and the mock does not verify that the correct channel is being cleaned up.

The polling fallback mock also has no `from().select().eq().single()` chain mocked — if the polling `useEffect` fires during tests (status starts PENDING), the interval callback will throw on `supabase.from(...)` not being a function.

**Fix:**
```ts
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const channel = {
      on: function() { return this },
      subscribe: vi.fn(function() { return this }),
    }
    return {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      })),
    }
  },
}))
```

---

## Info

### IN-01: Loop variable `window` shadows browser global in `stitchedTranscript.ts`

**File:** `worker/src/stitchedTranscript.ts:19`
**Issue:** The `for...of` loop variable is named `window`:
```ts
for (const window of mergedWindows) {
```
In a Node.js/ESM worker context this does not cause a runtime collision, but it shadows the browser global `window`, will trigger `no-shadow` lint rules in configs that include browser types, and is confusing for readers.

**Fix:** Rename to `span`, `win`, or `mergedWindow`:
```ts
for (const span of mergedWindows) {
```

---

### IN-02: React list key uses array index `i` instead of stable `sourceStartMs`

**File:** `src/components/status-view.tsx:246`
**Issue:**
```tsx
stitchedTranscript!.map((entry, i) => (
  <div key={i} className="flex gap-2 items-baseline">
```
When `stitchedTranscript` state is replaced by a Realtime update (different job result or re-processing), React uses array indices as stable keys and may produce incorrect DOM reconciliation. `sourceStartMs` is stable and unique per entry in practice.

**Fix:**
```tsx
stitchedTranscript!.map((entry) => (
  <div key={entry.sourceStartMs} className="flex gap-2 items-baseline">
```

---

### IN-03: `formatTimestamp` has no explicit unit tests; hour-scale behavior is undocumented

**File:** `src/__tests__/status-view.test.tsx` (gap) / `src/components/status-view.tsx:31-35`
**Issue:** `formatTimestamp` is exercised only implicitly via the transcript entry test (`64000 → [1:04]`). The spec lists three examples (`[1:04]`, `[12:30]`, `[0:05]`) but no tests cover `formatTimestamp(0) → [0:00]` or values >= 3,600,000 ms (1 hour). For a 90-minute video, `formatTimestamp(5430000)` returns `[90:30]` — minutes are not capped, and hours are not surfaced. This is not necessarily wrong but is undocumented behavior that could regress silently.

**Fix:** Add explicit unit tests for `formatTimestamp` boundary values: `0`, `59999`, `60000`, `3600000`. Document (or implement) the intended behavior for hour-length content before Phase 04 adds more UI around timestamps.

---

_Reviewed: 2026-06-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
