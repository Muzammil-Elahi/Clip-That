---
phase: 01-anonymous-job-shell
plan: 03
subsystem: ui
tags: [nextjs, react, supabase, realtime, tailwind, shadcn, base-ui, typescript, vitest, testing-library]

# Dependency graph
requires:
  - phase: 01-01
    provides: Supabase browser/server clients, Prisma singleton, JobStatus enum, shadcn components (Progress, Alert, Card, Button)
  - phase: 01-02
    provides: SubmissionForm routing to /status via router.push('/status')

provides:
  - StatusView client component with Supabase Realtime postgres_changes subscription, progress bar + rotating 5-message cycle, destructive Alert failure state, Done state
  - /status page server component with getUser() session validation, prisma.job.findFirst active-job lookup, empty state, StatusView render
  - 6 unit tests for StatusView (JOB-01 progress bar, JOB-02 failure Alert + Try again navigation)

affects:
  - Phase 2+ (worker updates job status in DB; Realtime subscription pushes change to StatusView; worker must write human-readable errorMessage)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase Realtime: createClient().channel(id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Job', filter: 'userId=eq.<uid>' }, handler).subscribe() — filter column must match exact PostgreSQL casing from Prisma migration"
    - "StatusView pattern: initialStatus prop drives initial state; Realtime UPDATE payload overrides status/errorMessage in local state"
    - "Progress bar pattern: starts at 10% on mount for PENDING, increments to 90% via setInterval(2000ms) during PROCESSING, snaps to 100% on DONE, hidden on FAILED"
    - "Message cycling: setInterval(4000) modulo STATUS_MESSAGES.length; cleared when status becomes DONE or FAILED"
    - "Heading deduplication: h1 in aria-live region omitted for FAILED state because AlertTitle already carries the heading text"

key-files:
  created:
    - src/components/status-view.tsx
    - src/app/status/page.tsx
    - src/__tests__/status-view.test.tsx
  modified:
    - src/__tests__/status-view.test.tsx (removed @testing-library/user-event import; used fireEvent instead)

key-decisions:
  - "Omit h1 from aria-live region on FAILED state — AlertTitle already renders 'Something went wrong'; rendering both caused getByText to find multiple elements"
  - "Used fireEvent.click instead of userEvent.click — @testing-library/user-event is not installed; fireEvent from @testing-library/react is sufficient for click interaction tests"
  - "Progress component from @base-ui/react/progress renders role='progressbar' with ARIA attributes natively — no additional aria props needed beyond aria-label"

patterns-established:
  - "Pattern: Realtime subscription cleanup — always call supabase.removeChannel(channel) in useEffect cleanup to prevent memory leaks across re-mounts"
  - "Pattern: Status-driven progress — use status transitions (PENDING→PROCESSING→DONE) as the single source of truth for progress animation via useEffect([status]) dependency"
  - "Pattern: Server page + client component split — page.tsx handles auth+DB server-side, passes initialStatus props to client component; client component owns Realtime subscription"

requirements-completed: [JOB-01, JOB-02]

# Metrics
duration: 20min
completed: 2026-06-13
---

# Phase 01 Plan 03: Status View with Supabase Realtime — Summary

**Supabase Realtime-subscribed StatusView client component with progress bar + 5-message rotation (JOB-01) and destructive Alert failure state with Try again navigation (JOB-02), plus /status server page shell with getUser() auth and prisma.job.findFirst active-job lookup**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-13T22:25:00Z
- **Completed:** 2026-06-13T22:45:00Z
- **Tasks:** 1 (TDD — 2 commits: test RED, feat GREEN)
- **Files modified:** 3

## Accomplishments

- Created `src/components/status-view.tsx`: 'use client' component with Supabase Realtime postgres_changes subscription scoped to userId, Base UI Progress component with ARIA roles, 5-message rotation via setInterval (4000ms), destructive Alert + "Try again" button on FAILED, progress snapping to 100% and "Done!" heading on DONE
- Created `src/app/status/page.tsx`: async server component with force-dynamic, getUser() network-validated session check (T-03-02), prisma.job.findFirst scoped by userId (T-03-04), empty state with "Start over" anchor link, StatusView render when active job found
- Created `src/__tests__/status-view.test.tsx`: 6 unit tests (PENDING progress bar + first message, FAILED alert + error text + button, no progressbar on FAILED, DONE heading, Try again calls router.push('/'))
- All 30 unit tests pass (24 previous + 6 new); npm run build exits 0

## Task Commits

TDD task with 2 commits:

1. **RED: Failing tests** - `19f00ef` (test)
2. **GREEN: Component + page implementation** - `0e5a5d2` (feat)

## Files Created/Modified

- `src/components/status-view.tsx` — 'use client' StatusView with Realtime subscription, progress bar, rotating messages, failure Alert, Done state
- `src/app/status/page.tsx` — Async server component, force-dynamic, getUser() auth, active job lookup, empty state + StatusView render
- `src/__tests__/status-view.test.tsx` — 6 unit tests; mocks supabase/client and next/navigation

## Decisions Made

- Omitted the `h1` heading from the `aria-live` region when status is FAILED. The `AlertTitle` within the destructive Alert already renders "Something went wrong" — rendering it in both the h1 and the AlertTitle caused `screen.getByText` to find multiple matching elements, failing the test. The Alert heading is visible and accessible; the aria-live h1 is only needed for status transitions (PENDING → PROCESSING → DONE).
- Used `fireEvent.click` from `@testing-library/react` instead of `userEvent.click` because `@testing-library/user-event` is not installed in the project. `fireEvent` is sufficient for click interaction unit tests; `userEvent` is preferable for E2E-style interaction tests but requires installation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate "Something went wrong" heading in FAILED state**
- **Found during:** Task 1 (GREEN phase — npm test first run)
- **Issue:** Both the `h1` in the `aria-live` region and the `AlertTitle` rendered "Something went wrong" for FAILED status. `screen.getByText('Something went wrong')` found 2 elements and threw `TestingLibraryElementError: Found multiple elements`.
- **Fix:** Conditionally omit the `h1` / `aria-live` region when `isFailed` is true; the Alert component carries the heading for the FAILED state.
- **Files modified:** `src/components/status-view.tsx`
- **Verification:** All 6 status-view tests pass; `npm run build` exits 0.
- **Committed in:** `0e5a5d2` (GREEN task commit)

**2. [Rule 3 - Blocking] Used fireEvent instead of userEvent (missing package)**
- **Found during:** Task 1 (RED phase — test file authored)
- **Issue:** Test file initially imported `@testing-library/user-event` which is not in package.json and not installed.
- **Fix:** Replaced `import userEvent from '@testing-library/user-event'` with `fireEvent` from `@testing-library/react` (already installed); changed `async` test to sync and `await userEvent.click(...)` to `fireEvent.click(...)`.
- **Files modified:** `src/__tests__/status-view.test.tsx`
- **Verification:** Tests run and pass without the missing import.
- **Committed in:** `0e5a5d2` (GREEN task commit, test file updated)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug — duplicate heading, 1 Rule 3 blocking — missing package substitution with installed equivalent)
**Impact on plan:** Both fixes required for correctness. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## Known Stubs

- `src/app/status/page.tsx` Done state renders "Your results are ready." placeholder text — future phases will replace this with real artifact links (video download, PDF notes) when the worker populates results.
- Supabase Realtime subscription filter uses `userId=eq.${userId}` — the exact PostgreSQL column casing must be verified after migration (`\d "Job"` in psql). Prisma generates camelCase column names in PostgreSQL, so this should be correct.

## Threat Flags

No new threat surface beyond what was modeled in the plan's threat model:
- T-03-01 (Realtime cross-user leakage): subscription filtered to `userId=eq.<uid>`; RLS on Job table per Plan 01-01 setup
- T-03-02 (Session spoofing): `getUser()` used in page.tsx — network-validated, not cookie-trusted
- T-03-03 (XSS via errorMessage): `errorMessage` rendered as JSX text node inside `AlertDescription`; no `dangerouslySetInnerHTML`
- T-03-04 (IDOR): `prisma.job.findFirst({ where: { userId: user.id, ... } })` scopes to authenticated user's own jobs

## Next Phase Readiness

- The anonymous job shell is complete — user can submit a job, see live status updates via Realtime, handle failures with "Try again", and see "Done!" when processing completes
- Phase 2 (worker) can now update job status in the Job table; StatusView will receive changes via Realtime subscription and update the UI automatically
- Worker must write human-readable `errorMessage` values (patterns documented in UI-SPEC Error State Copy section)
- Supabase Realtime publication must be enabled on the Job table (documented in Plan 01-01 User Setup Required, step 3)

---
*Phase: 01-anonymous-job-shell*
*Completed: 2026-06-13*
