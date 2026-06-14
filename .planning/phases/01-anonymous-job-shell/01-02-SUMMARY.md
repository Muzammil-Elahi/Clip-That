---
phase: 01-anonymous-job-shell
plan: 02
subsystem: ui
tags: [nextjs, react, tailwind, shadcn, lucide-react, vitest, testing-library, typescript, useActionState, useFormStatus]

# Dependency graph
requires:
  - phase: 01-01
    provides: submitJob Server Action, shadcn components (Button, Input, Label, Card), Vitest test infrastructure, @/lib/supabase, @/lib/prisma

provides:
  - SubmissionForm client component with useActionState + useFormStatus + field-level validation display
  - LoadingOverlay client component with Loader2 animate-spin shown during pending state
  - Home page server shell (src/app/page.tsx) with SubmissionForm and force-dynamic
  - 4 unit tests for SubmissionForm (render, URL error, topic error, button state)

affects:
  - 01-03 (status page — user arrives here after router.push('/status') from SubmissionForm)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useActionState([action, initial]) returns [state, formAction] — 2-value destructure (3rd pending value not used; useFormStatus used instead inside form)"
    - "Nested FormContent component pattern: useFormStatus must be called inside a child of <form>; parent holds useActionState state"
    - "fieldErrors type casting: Zod flatten() fieldErrors typed as {} in complex conditional return type; cast to Record<string, string[] | undefined> for key access"
    - "LoadingOverlay positioned absolutely inside relative wrapper, outside Card but inside relative div, so it covers the Card content"

key-files:
  created:
    - src/components/submission-form.tsx
    - src/components/loading-overlay.tsx
    - src/__tests__/submission-form.test.tsx
  modified:
    - src/app/page.tsx

key-decisions:
  - "Used 2-value useActionState destructure [state, formAction] — pending from useFormStatus (inside form) handles button disable and overlay trigger"
  - "FormContent is a nested component inside <form> so useFormStatus() can access the enclosing form's pending state (React constraint)"
  - "Cast fieldErrors to Record<string, string[] | undefined> — Zod 4's complex conditional SubmitJobResult type resolves fieldErrors as {} at TypeScript level"
  - "router.push('/status') has no query params or hash — job ID stays in React in-memory state only (D-07, T-02-01)"

patterns-established:
  - "Pattern: useFormStatus + FormContent nested component — use this pattern whenever you need isPending inside a form-bound Server Action"
  - "Pattern: aria-describedby on Input pointing to error <p> id — applied to all validated inputs in this project"
  - "Pattern: aria-live='polite' wrapper around session-level error messages"

requirements-completed: [SUB-01, SUB-02, SUB-05]

# Metrics
duration: 18min
completed: 2026-06-13
---

# Phase 01 Plan 02: Submission Form UI Summary

**React 19 submission form with useActionState + useFormStatus, field-level Zod error display, LoadingOverlay with Loader2 animate-spin, and router.push('/status') routing without job ID in URL**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-13T22:17:00Z
- **Completed:** 2026-06-13T22:35:00Z
- **Tasks:** 1 (TDD — 3 commits: test RED, feat GREEN, type fix)
- **Files modified:** 4

## Accomplishments

- Created `src/components/loading-overlay.tsx`: semi-transparent overlay with Loader2 + animate-spin, visible only when `show={true}` prop
- Created `src/components/submission-form.tsx`: 'use client' form using useActionState + useFormStatus with nested FormContent pattern, field-level error display with aria-describedby, router.push('/status') on job creation success (no job ID in URL per D-07)
- Replaced `src/app/page.tsx` default Next.js scaffold with SubmissionForm centered shell and force-dynamic
- Created `src/__tests__/submission-form.test.tsx`: 4 tests covering render, URL error display, topic error display, and button enabled state
- All 24 unit tests pass; npm run build exits 0 with no TypeScript errors

## Task Commits

TDD task with 3 commits:

1. **RED: Failing tests** - `c7eda84` (test)
2. **GREEN: Component implementation** - `29289bb` (feat)

## Files Created/Modified

- `src/components/loading-overlay.tsx` — 'use client' overlay with Loader2 animate-spin, show prop, bg-background/85 per UI-SPEC
- `src/components/submission-form.tsx` — 'use client' SubmissionForm with useActionState, useFormStatus (via FormContent), field errors, loading overlay trigger, router.push('/status')
- `src/app/page.tsx` — Server component home shell, SubmissionForm render, force-dynamic
- `src/__tests__/submission-form.test.tsx` — 4 unit tests; mocks useActionState, next/navigation, submitJob

## Decisions Made

- Used 2-value `useActionState` destructure instead of 3-value (dropped pending third value). Used `useFormStatus()` inside nested `FormContent` component as specified in the plan — this is the correct React constraint pattern.
- Cast `fieldErrors` to `Record<string, string[] | undefined>` to access by key — Zod 4's complex conditional return type for `SubmitJobResult` resolves `fieldErrors` as `{}` at the TypeScript level, preventing direct property access.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error on fieldErrors property access**
- **Found during:** Task 1 (GREEN phase — npm run build TypeScript check)
- **Issue:** `state.errors?.fieldErrors?.youtubeUrl` caused TS error "Property 'youtubeUrl' does not exist on type '{}'". The `SubmitJobResult` type in `submit-job.ts` uses a complex conditional type that TypeScript resolves as `{}` for `fieldErrors`.
- **Fix:** Cast `state.errors?.fieldErrors` to `Record<string, string[] | undefined>` before key access, then access with string index `['youtubeUrl']` and `['topic']`.
- **Files modified:** `src/components/submission-form.tsx`
- **Verification:** `npm run build` exits 0 with no TypeScript errors. All 24 tests pass.
- **Committed in:** `29289bb` (GREEN task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug — TypeScript type inference limitation with complex conditional types)
**Impact on plan:** Fix required for build to pass. Runtime behavior is unchanged — Zod 4's `flatten()` produces the correct structure at runtime.

## Issues Encountered

None beyond the TypeScript type resolution issue (documented in deviations above).

## Known Stubs

None. The `placeholder` attributes in the form are UI copy from the UI-SPEC Copywriting Contract, not stubs.

The `src/app/page.tsx` now renders the real SubmissionForm — the stub noted in Plan 01-01 SUMMARY is resolved.

## Threat Flags

No new threat surface beyond what was modeled in the plan's threat model:
- T-02-01 (Job ID routing): `router.push('/status')` with no params — mitigated
- T-02-02 (XSS via error display): All error text rendered as React JSX text nodes — mitigated

## Next Phase Readiness

- Submission form is fully functional — users can fill out the form, see validation errors, and submit
- LoadingOverlay appears during Server Action pending state
- On success, router routes to /status (placeholder page does not exist yet — created in Plan 01-03)
- No blockers for Plan 01-03 (status view with Supabase Realtime)

---
*Phase: 01-anonymous-job-shell*
*Completed: 2026-06-13*

## Self-Check: PASSED

- [x] `src/components/submission-form.tsx` exists and contains 'use client', `useActionState`, `useFormStatus`, `router.push('/status')`
- [x] `src/components/submission-form.tsx` does NOT contain `router.push('/status?jobId=` or `router.push('/status#`
- [x] `src/components/loading-overlay.tsx` exists and contains `animate-spin` and `Loader2`
- [x] `src/app/page.tsx` contains `SubmissionForm` and `export const dynamic = 'force-dynamic'`
- [x] URL input has `id="youtubeUrl"` and `name="youtubeUrl"`; topic input has `id="topic"` and `name="topic"`
- [x] Error `<p>` elements reference `aria-describedby` linking to input ids
- [x] `npm test -- --run src/__tests__/submission-form.test.tsx` exits 0 (4/4 tests)
- [x] `npm run build` exits 0
- [x] Commit `c7eda84` exists (RED test commit)
- [x] Commit `29289bb` exists (GREEN implementation commit)
