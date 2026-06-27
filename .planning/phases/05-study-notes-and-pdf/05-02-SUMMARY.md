---
phase: 05-study-notes-and-pdf
plan: 02
subsystem: frontend
tags: [react-markdown, react-pdf, tailwindcss-typography, vitest, rtl, tdd, status-view, notes-tab, pdf-download]

# Dependency graph
requires:
  - phase: 05-01-study-notes-and-pdf
    provides: studyNotes String? column on Job model + generateStudyNotes() worker function
  - phase: 04-stitched-video-output
    provides: StatusView tab layout (Video | Transcript | Notes) and three-state tab pattern
provides:
  - StudyNotesPDFDocument component rendering topic header + stripped notes body + YouTube URL footer
  - Notes tab three-state rendering (State A: loading / State B: available+PDF / State C: soft-fail)
  - PDFDownloadLink via next/dynamic ssr:false for browser-only PDF generation
  - studyNotes and notesSettled state in StatusView; Realtime handler and polling fallback extended
  - RTL tests for all three Notes tab states
affects:
  - src/components/status-view.tsx (props interface, state, Realtime, polling, tab content)
  - src/app/status/page.tsx (passes initialStudyNotes and youtubeUrl to StatusView)
  - src/types/job.ts (studyNotes: string | null added to Job interface)
  - src/app/globals.css (@plugin "@tailwindcss/typography" added)

# Tech tracking
tech-stack:
  added:
    - "react-markdown@10.1.0 — XSS-safe Markdown renderer with Tailwind typography prose class"
    - "@react-pdf/renderer@4.5.1 — client-side PDF generation; PDFDownloadLink for browser download"
    - "@tailwindcss/typography@0.5.20 — Tailwind v4 prose class for styled Markdown output"
  patterns:
    - "TDD pattern: RED (test scaffold fails because StatusView lacks new props) → GREEN (implementation, all pass)"
    - "Dynamic import with ssr: false for PDFDownloadLink (prevents @react-pdf/renderer build-time error)"
    - "notesSettled boolean distinguishes loading (null, DONE not yet confirmed) from soft-fail (null, DONE confirmed)"
    - "Tailwind v4 plugin: @plugin directive in globals.css, not tailwind.config.js"
    - "Existing test file (status-view.test.tsx) updated with PDF mocks + new required props (Rule 1 auto-fix)"

key-files:
  created:
    - src/components/StudyNotesPDFDocument.tsx
    - src/__tests__/status-view-notes-tab.test.tsx
  modified:
    - src/types/job.ts
    - src/app/globals.css
    - src/components/status-view.tsx
    - src/app/status/page.tsx
    - src/__tests__/status-view.test.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "notesSettled initialized to true when initialStatus===DONE so server-rendered DONE jobs immediately show soft-fail or notes rather than loading text"
  - "PDFDownloadLink loaded via dynamic() with ssr: false following RESEARCH.md Pitfall 2 recommendation"
  - "stripMarkdown() helper in StudyNotesPDFDocument strips Markdown characters before PDF Text node (RESEARCH.md Pitfall 6)"
  - "next/dynamic mock in tests returns synchronous stub (MockPDFDownloadLink) so PDF button is available immediately in jsdom"
  - "Updated existing status-view.test.tsx to add PDF mocks and new required props — Notes tab test changed from old placeholder copy to new soft-fail copy"

requirements-completed: [NOT-05]

# Metrics
duration: 7min
completed: 2026-06-27
---

# Phase 05 Plan 02: Study Notes and PDF Summary

**Notes tab three-state rendering (loading/available/soft-fail) with react-markdown prose, PDFDownloadLink via dynamic import, and StudyNotesPDFDocument (topic header + Markdown-stripped notes body + YouTube URL footer)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-27T19:43:00Z
- **Completed:** 2026-06-27T19:47:55Z
- **Tasks:** 3 (TDD RED test scaffold + packages/component/type + StatusView GREEN)
- **Files modified:** 8

## Accomplishments

- Created `src/__tests__/status-view-notes-tab.test.tsx` with three RTL tests (RED: failing because StatusView lacks new props)
- Installed `react-markdown@10.1.0`, `@react-pdf/renderer@4.5.1`, `@tailwindcss/typography@0.5.20`
- Added `@plugin "@tailwindcss/typography"` to `globals.css` (Tailwind v4 CSS-first registration)
- Added `studyNotes: string | null` to `Job` interface in `src/types/job.ts`
- Created `src/components/StudyNotesPDFDocument.tsx` with `stripMarkdown()` helper, named export, Helvetica A4 layout
- Extended `StatusViewProps` with `initialStudyNotes` and `youtubeUrl` props
- Added `studyNotes` and `notesSettled` useState with correct initialization
- Extended Supabase Realtime handler and polling fallback to include `studyNotes` and `setNotesSettled(true)`
- Replaced Notes tab placeholder with three-state conditional (State A/B/C per D-06/D-09)
- State B includes `react-markdown` prose wrapper and `PDFDownloadLink` with `Download` icon and "Download PDF" label
- Updated `status/page.tsx` to pass `initialStudyNotes` and `youtubeUrl` to `StatusView`
- All 41 frontend tests GREEN (6 test files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — Notes tab RTL test scaffold (RED)** — `84fff6d` (test)
2. **Task 2: Install packages + Tailwind plugin + Job type + StudyNotesPDFDocument** — `b43696c` (feat)
3. **Task 3: Extend StatusView + status page (GREEN)** — `7c1ddd8` (feat)

## Files Created/Modified

- `src/__tests__/status-view-notes-tab.test.tsx` — 3 RTL tests: notes available (Download PDF button), PROCESSING (no tabs), DONE+null (soft-fail message)
- `src/components/StudyNotesPDFDocument.tsx` — exports `StudyNotesPDFDocument`; `stripMarkdown()` strips `##`, `**`, `*`, `- `, `` ` `` before PDF Text node; A4 page with padding 48, Helvetica font
- `src/types/job.ts` — added `studyNotes: string | null` after `videoExpiresAt`
- `src/app/globals.css` — added `@plugin "@tailwindcss/typography";` after @import lines
- `src/components/status-view.tsx` — extended props, state, Realtime handler, polling fallback; Notes tab three-state conditional rendering; PDFDownloadLink via dynamic import
- `src/app/status/page.tsx` — passes `initialStudyNotes={job.studyNotes ?? null}` and `youtubeUrl={job.youtubeUrl}`
- `src/__tests__/status-view.test.tsx` — added next/dynamic + @react-pdf/renderer mocks; added new required props to baseProps; updated Notes tab test to match new soft-fail copy
- `package.json` / `package-lock.json` — added three npm packages

## Decisions Made

- `notesSettled` initialized to `initialStatus === JobStatus.DONE` so server-rendered DONE jobs show correct state immediately without waiting for Realtime (per RESEARCH.md A4 assumption resolution)
- `PDFDownloadLink` loaded via `dynamic(() => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink), { ssr: false, loading: () => null })` — prevents `TypeError: ba.Component is not a constructor` at `next build` (RESEARCH.md Pitfall 2)
- `stripMarkdown()` uses lightweight regex (no additional library) per RESEARCH.md Pitfall 6 and Anti-Patterns section
- `@plugin "@tailwindcss/typography"` in CSS not `tailwind.config.js` — Tailwind v4 CSS-first pattern (RESEARCH.md Pitfall 3, Pattern 7)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated status-view.test.tsx to add PDF mocks and new required props**
- **Found during:** Task 3 (GREEN phase — running full test suite)
- **Issue:** `status-view.test.tsx` had a test checking for old placeholder text "Study notes will appear here in a future update." The test's `baseProps` also lacked the new required `initialStudyNotes` and `youtubeUrl` props. The file also had no mocks for `next/dynamic` or `@react-pdf/renderer`, causing potential errors when StatusView is updated to import these.
- **Fix:** Added `next/dynamic` and `@react-pdf/renderer` vi.mock blocks; added `initialStudyNotes: null` and `youtubeUrl` to `baseProps`; updated the Notes tab test from old placeholder copy to new soft-fail message copy (matching the D-09 copy contract in 05-UI-SPEC.md)
- **Files modified:** `src/__tests__/status-view.test.tsx`
- **Verification:** All 41 tests pass GREEN after fix
- **Committed in:** `7c1ddd8` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required fix for full test suite to pass. No scope change.

## Known Stubs

None — Notes tab implementation is fully wired to `studyNotes` state from Realtime/polling. No hardcoded empty values or placeholder text in the production code paths.

## Threat Flags

No new security surface beyond what the plan's threat model covers:
- `react-markdown` renders `studyNotes` as semantic HTML (XSS-safe by default) — T-05-05 mitigated
- `PDFDownloadLink` generates a local Blob download not injected into DOM — T-05-06 accepted
- `PDFDownloadLink` with `ssr: false` prevents server-side execution — T-05-07 accepted

## User Setup Required

Before the Notes tab shows real content in production:

1. Apply the Prisma migration (`studyNotes` column) — see Phase 05 Plan 01 SUMMARY for details
2. Add `GEMINI_API_KEY` to `worker/.env.local` and Railway environment variables
3. If notes generation soft-fails (API key missing or Gemini error), the Notes tab will show State C (soft-fail) — video and transcript remain accessible

## Next Phase Readiness

- Phase 05 complete — `studyNotes` generated by worker (Plan 01) and rendered in browser Notes tab (Plan 02)
- NOT-05 requirement satisfied: "Download PDF" button appears when notes available; clicking triggers browser download
- Phase 06 (semantic matching) can proceed — no blockers from this plan

---
*Phase: 05-study-notes-and-pdf*
*Completed: 2026-06-27*

## Self-Check: PASSED

- [x] `src/__tests__/status-view-notes-tab.test.tsx` — exists (created Task 1)
- [x] `src/components/StudyNotesPDFDocument.tsx` — exists (created Task 2)
- [x] `src/types/job.ts` contains `studyNotes` — verified via grep
- [x] `src/app/globals.css` contains `@plugin "@tailwindcss/typography"` — verified via grep
- [x] `src/components/status-view.tsx` contains `studyNotes`, `notesSettled`, `PDFDownloadLink`, `prose prose-neutral`, `ssr: false` — verified via grep
- [x] `src/app/status/page.tsx` contains `initialStudyNotes` — verified via grep
- [x] All 41 frontend tests GREEN — verified via `npm run test:run`
- [x] Commits 84fff6d, b43696c, 7c1ddd8 — created and verified
