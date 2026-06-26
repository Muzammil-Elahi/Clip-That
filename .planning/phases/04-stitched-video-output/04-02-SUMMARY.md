---
phase: "04-stitched-video-output"
plan: "02"
subsystem: "frontend"
tags: ["video-tab", "realtime", "status-view", "html5-video", "react-testing-library"]
dependency_graph:
  requires:
    - "04-01 (videoUrl String? on Job row via Supabase Storage)"
  provides:
    - "StatusViewProps.initialVideoUrl: string | null"
    - "videoUrl state in StatusView with Realtime + polling propagation"
    - "Video tab: conditional <video> player / Working on it... / No clips found"
  affects:
    - "Browser — student can play stitched video clip in the Video tab"
tech_stack:
  added:
    - "No new npm packages — HTML5 <video> is a native browser API (T-04-SC accepted)"
  patterns:
    - "base-ui Tabs unmounts inactive panels by default (keepMounted=false) — click tab before asserting content in tests"
    - "Three-state conditional Video tab: no-match → No clips found; videoUrl set → <video>; else → Working on it..."
    - "React Testing Library fireEvent.click on tab button to activate panel before assertion"
key_files:
  created:
    - "src/__tests__/status-view-video-tab.test.tsx — 3 RTL tests covering Video tab states (RED + GREEN)"
  modified:
    - "src/types/job.ts — Job interface gains videoUrl: string | null and videoExpiresAt: string | null (Phase 4)"
    - "src/components/status-view.tsx — StatusViewProps, useState, Realtime handler, polling fallback, Video tab content"
    - "src/app/status/page.tsx — initialVideoUrl={job.videoUrl ?? null} prop passed to StatusView"
    - "src/__tests__/status-view.test.tsx — baseProps gains initialVideoUrl; fixed 2 pre-existing tab tests (base-ui unmount behavior)"
decisions:
  - "base-ui Tabs unmounts inactive panels from DOM (keepMounted=false default) — tests must click tab button before asserting tab content"
  - "Three Video tab states per D-08/D-09: <video controls> when videoUrl set; Working on it... when transcript non-empty; No clips found for {topic} when transcript empty"
  - "topic rendered as JSX text node child in No clips found message — no dangerouslySetInnerHTML (T-04-09)"
  - "videoUrl flows Realtime: setVideoUrl(payload.new.videoUrl ?? null) added to existing postgres_changes callback — not a separate useEffect"
  - "Polling fallback select extended to include videoUrl column alongside existing fields"
metrics:
  duration: "8 minutes"
  completed_date: "2026-06-26"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  tests_total: 95
  tests_added: 3
---

# Phase 04 Plan 02: Frontend Video Tab Summary

**One-liner:** Video tab conditional rendering with HTML5 <video> player, Working on it... state, and No clips found state — wired to Realtime and polling fallback from the Job row's videoUrl field.

## What Was Built

**Task 1 (RED):** Extended `src/types/job.ts` Job interface with `videoUrl: string | null` and `videoExpiresAt: string | null` fields (Phase 4). Created `src/__tests__/status-view-video-tab.test.tsx` with 3 failing tests covering the three Video tab states.

**Task 2 (GREEN):** Made four targeted changes to `src/components/status-view.tsx`:
1. `StatusViewProps` gains `initialVideoUrl: string | null` (D-08)
2. `useState<string | null>(initialVideoUrl ?? null)` for `videoUrl` state
3. Realtime `postgres_changes` callback adds `setVideoUrl(payload.new.videoUrl ?? null)`
4. Polling fallback: `select` extended to include `videoUrl`; `setVideoUrl(row.videoUrl ?? null)` added after `setStitchedTranscript`
5. Video tab `<TabsContent value="video">` replaced with three-state conditional per D-09:
   - If `!videoUrl && stitchedTranscript.length === 0`: "No clips found for {topic}."
   - Else if `videoUrl`: `<video controls src={videoUrl} className="w-full rounded-md" />`
   - Else: "Working on it..."

`src/app/status/page.tsx` updated to pass `initialVideoUrl={job.videoUrl ?? null}` to `StatusView` (the Prisma `findFirst` returns all fields including `videoUrl` String? by default).

## Test Results

- Frontend: 5 test files, 38 tests — all pass (35 existing + 3 new)
- Worker: 9 test files, 57 tests — all pass (unchanged)
- TDD gate: RED commit `c371742` (3 failing tests), GREEN commit `cdf2905` (all 38 pass)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] base-ui Tabs unmounts inactive panels — pre-existing test failures**
- **Found during:** Task 2 full test run
- **Issue:** `@base-ui/react/tabs` `TabsPanel` has `keepMounted=false` by default. Inactive tab panels are removed from the DOM (`shouldRender = keepMounted || mounted`). Two existing tests in `status-view.test.tsx` — "Video tab shows spec-defined copy when DONE (WR-02)" and "Notes tab shows spec-defined copy when DONE (WR-02)" — were already failing before this plan because they asserted content in non-active panels without first clicking the tab trigger.
- **Fix:** Updated both tests to call `fireEvent.click(screen.getByRole('tab', { name: /video/i }))` and `fireEvent.click(screen.getByRole('tab', { name: /notes/i }))` before asserting content. Also updated the new `status-view-video-tab.test.tsx` to use the same pattern — a `clickVideoTab()` helper that clicks the Video tab button before each assertion.
- **Files modified:** `src/__tests__/status-view.test.tsx`, `src/__tests__/status-view-video-tab.test.tsx`
- **Commit:** cdf2905

## Security

T-04-07 (videoUrl Information Disclosure): Mitigated — Realtime channel is filtered to `id=eq.${initialJobId}` per existing subscription; only the job owner receives the payload.

T-04-08 (videoUrl as `<video src>`): Mitigated — videoUrl comes from the database via Realtime (server-controlled); not a user-supplied string; no XSS risk; Content Security Policy restricts media-src.

T-04-09 (topic in "No clips found for {topic}"): Mitigated — topic is a JSX text node child using `{topic}` interpolation; never uses `dangerouslySetInnerHTML`.

T-04-SC (No new npm packages): Accepted — HTML5 `<video>` is a native browser API; no new packages installed.

## Known Stubs

None. The Phase 4-02 Video tab is fully wired end-to-end:
- `videoUrl` flows from Job row → Supabase Realtime → `status-view.tsx` Video tab
- Polling fallback also propagates `videoUrl`
- Server component passes `initialVideoUrl` from the Prisma query result
- `<video controls src={videoUrl}>` renders when videoUrl is non-null

## Threat Flags

No new threat surface beyond the plan's threat model. All four threat entries (T-04-07 through T-04-SC) are mitigated or accepted as specified.

## Manual Verification Items

The following require human sign-off (see Plan 04-02 `<verification>` block):
1. Submit a YouTube URL + topic; wait for DONE status; confirm Video tab shows `<video>` player (not placeholder text)
2. Confirm video plays when clicked (tests signed URL + CORS)
3. Submit a URL for a video where the topic does not appear; confirm Video tab shows "No clips found for `<topic>`" message
4. Confirm Supabase Storage bucket 'clip-videos' exists as private (prerequisite from Plan 04-01)
5. Confirm SUPABASE_SERVICE_ROLE_KEY is set in worker environment (prerequisite from Plan 04-01)
6. After 24h, verify the video player shows an error (signed URL expired) and worker cleanup pass has nulled videoUrl on the Job row

## Self-Check: PASSED

- src/types/job.ts contains `videoUrl: string | null` and `videoExpiresAt: string | null` — FOUND
- src/components/status-view.tsx contains `initialVideoUrl: string | null` in StatusViewProps — FOUND
- src/components/status-view.tsx contains `useState<string | null>(initialVideoUrl` — FOUND
- src/components/status-view.tsx Realtime handler contains `setVideoUrl(payload.new.videoUrl` — FOUND
- src/components/status-view.tsx polling fallback select contains `videoUrl` — FOUND
- src/components/status-view.tsx Video tab contains `<video` element — FOUND
- src/components/status-view.tsx Video tab contains "No clips found for" message — FOUND
- src/app/status/page.tsx contains `initialVideoUrl={job.videoUrl` — FOUND
- src/__tests__/status-view-video-tab.test.tsx exists with 3 test cases — FOUND
- No `dangerouslySetInnerHTML` in any modified file — CONFIRMED
- Commits c371742 (RED) and cdf2905 (GREEN) exist in git log — CONFIRMED
- npm run test:run exits 0 (38/38 frontend tests pass) — CONFIRMED
- cd worker && npm run test:run exits 0 (57/57 worker tests pass) — CONFIRMED
