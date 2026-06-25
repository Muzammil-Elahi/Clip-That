---
phase: "03"
status: findings
critical: 3
warning: 4
info: 3
---

## Summary

Phase 03 added context expansion, overlap merging, stitched transcript generation (worker), and the corresponding frontend tab UI (status-view). The implementation is generally well-structured with clean pure-function modules and reasonable test coverage. However, three correctness bugs were found that can produce panics or silently wrong output at runtime; four warnings cover missing error propagation, a type-safety gap, inconsistent UI copy, and a test coverage gap; three info items cover code quality issues.

---

## Findings

---

### CR-01 — `Math.min(...[])` panics when a ClipMatch has an empty `segmentIndices` array

**Severity:** Critical
**File:** `worker/src/contextExpander.ts`, line 33–34
**Description:**
`expandContextWindows` computes `innerStart` and `innerEnd` using the spread operator:

```ts
const innerStart = Math.min(...match.segmentIndices)
const innerEnd   = Math.max(...match.segmentIndices)
```

When `match.segmentIndices` is an empty array, `Math.min()` returns `Infinity` and `Math.max()` returns `-Infinity`. These are then used as array indices (`segments[Infinity]`), which returns `undefined`, and the subsequent `Math.round(segments[leftIdx].offset * 1000)` call throws `TypeError: Cannot read properties of undefined`. This crash causes the entire worker job to land in FAILED status instead of DONE.

The `ClipMatch` interface declares `segmentIndices: number[]` with no non-empty constraint, and the matcher (`matcher.ts`) can only produce non-empty arrays today, but the type contract does not enforce this. Future matchers or test fixtures could introduce empty arrays.

**Recommendation:**
Add a guard at the top of the `.map()` callback:

```ts
if (match.segmentIndices.length === 0) {
  // No segments associated — return empty window sentinel or skip
  return null
}
```

Then filter nulls from the result. Alternatively, add an `assert(match.segmentIndices.length > 0)` so failures are surfaced immediately with a useful error. Also add a test case:

```ts
it('skips/ignores ClipMatch with empty segmentIndices without throwing', () => {
  const segments = [{ text: 'a', offset: 0, duration: 5, lang: 'en' }]
  const matches = [{ startMs: 0, endMs: 5000, text: 'a', segmentIndices: [] }]
  expect(() => expandContextWindows(segments, matches)).not.toThrow()
})
```

---

### CR-02 — `expandContextWindows` panics on an empty `segments` array when matches are non-empty

**Severity:** Critical
**File:** `worker/src/contextExpander.ts`, line 33–57
**Description:**
When `segments` is empty but `matches` is non-empty, the algorithm sets `leftIdx = innerStart` (e.g., 0) and then immediately tries to read `segments[leftIdx].offset`, which is `undefined`, throwing `TypeError`. The while-loop condition `leftIdx > 0` prevents the walk, but the return statement at line 55 still dereferences `segments[0]` which is `undefined`:

```ts
startMs: Math.round(segments[leftIdx].offset * 1000),  // undefined.offset → crash
```

The worker should not encounter this in production (no segments means `fetchTranscript` returned nothing, and `buildClipPlan` would return no matches), but the function has no documented precondition and its type signature allows `segments: TranscriptSegment[]` (possibly empty) with `matches: ClipMatch[]` (possibly non-empty). Defensive code here prevents future misuse and a confusing crash path.

**Recommendation:**
Add an early guard:

```ts
if (segments.length === 0) return []
```

At the top of `expandContextWindows` (before the `matches.map`). This is consistent with `mergeOverlappingWindows`'s existing early-return pattern.

---

### CR-03 — Worker marks job PROCESSING before setting `processingJob = true`, leaving a window where SIGTERM can interrupt mid-job

**Severity:** Critical
**File:** `worker/src/index.ts`, lines 47–52
**Description:**
The graceful shutdown handler waits for `processingJob` to be false before disconnecting. However, `processingJob` is only set to `true` at line 52, *after* the job has already been marked `PROCESSING` in the database at lines 47–50:

```ts
await prisma.job.update({ where: { id: job.id }, data: { status: 'PROCESSING' } })
// <--- SIGTERM window: processingJob is still false here
processingJob = true
try { ... }
```

If SIGTERM arrives between the `prisma.job.update` at line 50 and `processingJob = true` at line 52, the shutdown handler exits immediately (because `processingJob` is false), the database connection is closed, and the job is permanently stuck in `PROCESSING` status with no DONE or FAILED write ever completing. On the next worker start, this job is never retried because the query only picks up `PENDING` jobs.

This is a pre-existing structural issue (existed before Phase 03) but Phase 03 adds more work between the flag and actual processing (context expansion, stitched transcript), widening the window and making a stuck-PROCESSING job even more likely to be noticed.

**Recommendation:**
Move `processingJob = true` to immediately before the `prisma.job.update` call that marks the job PROCESSING:

```ts
processingJob = true
await prisma.job.update({ where: { id: job.id }, data: { status: 'PROCESSING' } })
try {
  ...
} catch (err) {
  ...
} finally {
  processingJob = false
}
```

Also consider adding a stuck-PROCESSING recovery query on startup that resets old PROCESSING jobs back to PENDING.

---

### WR-01 — Unsafe runtime cast of `stitchedTranscript` JSON from Prisma lacks shape validation

**Severity:** Warning
**File:** `src/app/status/page.tsx`, line 63
**Description:**
The Prisma `Job.stitchedTranscript` column is typed as `Json | null` (a Prisma `JsonValue` which can be any JSON value: string, number, boolean, object, array, or null). The cast:

```ts
initialStitchedTranscript={(job.stitchedTranscript as StitchedTranscriptEntry[] | null) ?? null}
```

is a TypeScript-only type assertion. It does not validate the runtime shape. If the database contains a malformed or legacy `stitchedTranscript` value (e.g., a plain object, a number, or an array with missing fields), the component will receive unexpected data and either render nothing, render `undefined`, or throw at `entry.sourceStartMs` in `formatTimestamp`. The plan acknowledges this as accepted (T-03-08), but the mitigation ("runtime shape is guaranteed by worker via plan 03-01") is only true for newly processed jobs — database rows from schema migration or future bugs are unguarded.

**Recommendation:**
Add a narrow runtime validation guard at the cast site:

```ts
function toStitchedTranscript(raw: unknown): StitchedTranscriptEntry[] | null {
  if (!Array.isArray(raw)) return null
  return raw.filter(
    (e): e is StitchedTranscriptEntry =>
      typeof e === 'object' && e !== null &&
      typeof (e as any).sourceStartMs === 'number' &&
      typeof (e as any).sourceEndMs === 'number' &&
      typeof (e as any).text === 'string'
  )
}
```

Then use `toStitchedTranscript(job.stitchedTranscript)` instead of the bare cast.

---

### WR-02 — Video and Notes tab copy diverges from the spec when transcript is empty

**Severity:** Warning
**File:** `src/components/status-view.tsx`, lines 206–210, 231–235
**Description:**
The plan and UI-SPEC define exact copy for Video and Notes tabs:

- Video: `"Video clips will be available here once processing is complete."`
- Notes: `"Study notes will appear here in a future update."`

The implementation adds a conditional that changes these messages when `stitchedTranscript` is empty:

```tsx
{(stitchedTranscript?.length ?? 0) === 0
  ? `No mentions of "${topic}" were found in this video, so there are no video clips to show.`
  : 'Video clips will be available here once processing is complete.'}
```

The empty-case messages in Video and Notes tabs are not specified in the plan — they are invented copy not present in the UI-SPEC. The Transcript tab correctly uses the spec-defined empty-state message (`'No mentions of "[topic]" were found in this video.'`). The Video and Notes tabs now show different (longer) messages that could confuse users who see different text across tabs for the same "no content" condition.

No tests cover the Video or Notes tab content when `stitchedTranscript` is empty, meaning this divergence from spec is invisible to the test suite.

**Recommendation:**
Simplify Video and Notes tab to use their spec-defined messages unconditionally:

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

Remove the conditional logic from these two tabs. Add test cases that assert the Video and Notes tab content.

---

### WR-03 — `mergeOverlappingWindows` loses `startIdx` consistency when merging non-sorted windows with non-contiguous indices

**Severity:** Warning
**File:** `worker/src/contextExpander.ts`, lines 75–82
**Description:**
When merging two overlapping windows where the `endMs`-ordered winner differs from the `startMs`-ordered winner, the merge correctly picks `Math.max(last.endIdx, curr.endIdx)` and `Math.max(last.endMs, curr.endMs)`. However, `startIdx` is always taken from `last` (the first window in sorted order by `startMs`).

The assumption is that because windows are sorted by `startMs`, the window with the lower `startMs` also has the lower `startIdx`. This holds when `expandContextWindows` produces windows derived from monotonically ordered segments, but it is not guaranteed by the `ExpandedWindow` interface — `startMs` and `startIdx` are independent fields. If a caller constructs windows where `startMs` order differs from `startIdx` order (e.g., two clips from the same segment range but with different computed millisecond offsets due to floating-point rounding), `mergeOverlappingWindows` will return a merged window with an inconsistent `startIdx`/`startMs` pair.

`buildStitchedTranscript` iterates from `window.startIdx` to `window.endIdx`, so an incorrect `startIdx` directly produces the wrong transcript entries.

**Recommendation:**
When merging, also pick the minimum `startIdx`:

```ts
merged[merged.length - 1] = {
  startIdx: Math.min(last.startIdx, curr.startIdx),  // was: last.startIdx only
  endIdx: Math.max(last.endIdx, curr.endIdx),
  startMs: last.startMs,
  endMs: Math.max(last.endMs, curr.endMs),
}
```

Add a test case with windows where `startMs` order differs from `startIdx` order to verify the guard.

---

### WR-04 — Test for "three tabs visible" passes even when `@base-ui/react/tabs` renders tabs without `role="tab"` ARIA attribute

**Severity:** Warning
**File:** `src/__tests__/status-view.test.tsx`, lines 139–145
**Description:**
The test relies on `getByRole('tab', { name: /video/i })` to verify tab presence. The `TabsTrigger` component wraps `@base-ui/react/tabs`'s `TabsPrimitive.Tab`, which uses `role="tab"` from the ARIA spec. However, the test environment (jsdom) may not support the `@base-ui/react` tabs component correctly if its ARIA roles depend on browser-specific behavior or context (parent `role="tablist"` is needed for `role="tab"` to be semantically valid).

More concretely: the mock Supabase client returns an object where `channel()` returns `{ on: () => ({ subscribe: vi.fn() }) }` but `removeChannel` is on the top-level mock object — not on the returned channel object. The `useEffect` cleanup calls `supabase.removeChannel(channel)`, where `channel` is the return value of `.subscribe()` which is `vi.fn()` (not the channel object). This means the cleanup function effectively calls `supabase.removeChannel(vi.fn())` which silently does nothing. While this doesn't break the test, it means channel cleanup is never exercised in tests and the Realtime subscription leak path is invisible.

**Recommendation:**
Fix the mock to return the channel object from `subscribe()`:

```ts
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const channel = {
      on: () => channel,       // returns the channel for chaining
      subscribe: vi.fn(() => channel), // subscribe returns the channel itself
    }
    return {
      channel: () => channel,
      removeChannel: vi.fn(),
    }
  },
}))
```

This makes the mock match the actual Supabase client chaining pattern and allows cleanup code to be exercised.

---

## Info

---

### IN-01 — `for...of window` variable shadows global `window` object

**Severity:** Info
**File:** `worker/src/stitchedTranscript.ts`, line 19
**Description:**
The variable name `window` is used as the loop variable:

```ts
for (const window of mergedWindows) {
```

In a Node.js/ESM worker context, `window` is not defined globally, so this does not cause a runtime collision. However, it shadows the browser global `window` and will trigger `no-shadow` linting rules in environments that include browser types. It is also an unexpected naming choice for a non-browser module and will likely confuse future readers.

**Recommendation:** Rename to `win`, `span`, or `mergedWindow`:

```ts
for (const span of mergedWindows) {
```

---

### IN-02 — `key={i}` on transcript entry list uses array index, not a stable identifier

**Severity:** Info
**File:** `src/components/status-view.tsx`, line 219
**Description:**
React list rendering uses the array index as the key:

```tsx
stitchedTranscript!.map((entry, i) => (
  <div key={i} ...>
```

When the `stitchedTranscript` state is updated via Realtime (e.g., the worker sends a different job result), React will use the array indices as stable keys and may produce incorrect DOM reconciliation. `sourceStartMs` is stable, unique per entry in practice, and makes a better key.

**Recommendation:**

```tsx
stitchedTranscript!.map((entry) => (
  <div key={entry.sourceStartMs} ...>
```

---

### IN-03 — No test coverage for `formatTimestamp` edge cases: exactly 0 ms and values >= 1 hour

**Severity:** Info
**File:** `src/__tests__/status-view.test.tsx` (gap) / `src/components/status-view.tsx`, lines 31–35
**Description:**
`formatTimestamp` is tested implicitly via the transcript entry test (64000 → `[1:04]`). The plan specifies three examples: `[1:04]`, `[12:30]`, `[0:05]`. There are no tests for `formatTimestamp(0)` → `[0:00]` or for values >= 3600000 ms (1 hour), where `Math.floor(ms / 60000)` returns 60+ minutes (e.g., 3660000 → `[61:00]`). The `[M:SS]` format does not include hours, so a 90-minute lecture transcript would show `[90:30]` rather than `[1:30:30]`. This is not necessarily wrong (the plan does not specify hour format), but it is an undocumented behavior that should be tested so regressions are caught.

**Recommendation:**
Add explicit unit tests for `formatTimestamp` boundary values: `0`, `59999`, `60000`, `3600000` (1 hour). Consider whether hour-display support is needed before Phase 04.

---

## Conclusion

Three critical correctness bugs require attention before this code is in production:

1. Empty `segmentIndices` in a `ClipMatch` causes a worker crash (CR-01)
2. An empty `segments` array with non-empty matches crashes `expandContextWindows` (CR-02)
3. The `processingJob` guard flag is set too late, allowing SIGTERM to leave jobs permanently stuck in PROCESSING (CR-03)

The warnings address a runtime type-safety gap in the Prisma JSON cast, spec deviation in Video/Notes tab copy, a subtle `startIdx` inconsistency in overlap merging, and a test mock mismatch that hides Realtime cleanup bugs. The info items are low-risk code quality improvements.

The overall architecture is sound: the pure-function split between `contextExpander.ts`, `stitchedTranscript.ts`, and the worker loop is clean, and the XSS threat (T-03-06, T-03-07) is properly mitigated by using JSX text nodes throughout.

_Reviewed: 2026-06-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
