---
phase: 05-study-notes-and-pdf
verified: 2026-06-27T20:05:00Z
status: human_needed
score: 13/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Click 'Download PDF' button in Notes tab and confirm browser receives a .pdf file download"
    expected: "Browser initiates a file download named study-notes-{topic}.pdf; file opens in a PDF viewer and contains the topic header, stripped notes body, and YouTube URL footer"
    why_human: "PDFDownloadLink generates a Blob in-browser and triggers a browser download event. This cannot be verified with grep or module inspection — requires a running browser session with an active job that has studyNotes populated."
---

# Phase 05: Study Notes and PDF Verification Report

**Phase Goal:** Add AI-generated study notes to the worker pipeline and surface them in the browser with a three-state Notes tab and PDF download capability.
**Verified:** 2026-06-27T20:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Worker calls Gemini after buildStitchedTranscript() and before the DONE prisma update | VERIFIED | `worker/src/index.ts` lines 96-103: generateStudyNotes call between stitchedTranscript build (line 93) and prisma.job.update DONE block (line 127) |
| 2 | generateStudyNotes() returns a Markdown string on success | VERIFIED | `worker/src/notesGenerator.ts` line 57: `return response.text ?? null`; happy-path test passes returning string containing 'Explanation' |
| 3 | generateStudyNotes() returns null and logs an error when Gemini fails after 1 retry (soft-fail) | VERIFIED | notesGenerator.ts lines 58-66: loop covers attempt 0 (warn + sleep 2000) and attempt 1 (error + return null); soft-fail test (4/4 GREEN) |
| 4 | If GEMINI_API_KEY is absent, note generation is skipped and studyNotes = null (soft-fail, not fatal) | VERIFIED | notesGenerator.ts lines 43-46: explicit guard `if (!process.env.GEMINI_API_KEY) { ... return null }`; missing-key test passes without calling generateContent |
| 5 | Job always transitions to DONE regardless of note generation outcome | VERIFIED | index.ts: generateStudyNotes result captured into `studyNotes` variable (can be null); `prisma.job.update` DONE block always executes after; failure only reaches FAILED path via the outer try/catch which is unrelated to studyNotes |
| 6 | studyNotes is persisted on the Job row as Text? (no Prisma cast) | VERIFIED | index.ts line 135: `studyNotes,` in DONE update payload with comment "string \| null — Text? column, no cast needed"; schema.prisma line 30: `studyNotes String?` |
| 7 | Notes tab shows 'Generating your study notes...' when job is DONE but studyNotes not yet arrived | VERIFIED | status-view.tsx line 295-299: State A condition `!notesSettled && studyNotes === null` renders exact text; RTL test suite covers PROCESSING state (no tabs) |
| 8 | Notes tab renders react-markdown prose when studyNotes is a non-empty string | VERIFIED | status-view.tsx lines 301-318: State B `studyNotes !== null` renders `<Markdown>{studyNotes}</Markdown>` inside `div.prose.prose-neutral.max-w-none` |
| 9 | Notes tab shows a 'Download PDF' button when studyNotes is available | VERIFIED | status-view.tsx line 311: `{loading ? 'Preparing PDF...' : 'Download PDF'}` Button inside State B; RTL test `screen.getByText('Download PDF')` passes |
| 10 | Clicking Download PDF triggers a browser download of a .pdf file | HUMAN | PDFDownloadLink generates a Blob client-side — verified by code pattern (dynamic import ssr:false, fileName prop) but actual browser download cannot be confirmed without a running browser |
| 11 | Notes tab shows soft-fail message when notesSettled=true and studyNotes is null | VERIFIED | status-view.tsx lines 319-323: State C `notesSettled && studyNotes === null` renders exact text "Notes could not be generated. Your video and transcript are still available."; RTL test passes |
| 12 | studyNotes is included in the Supabase Realtime handler and polling fallback select() call | VERIFIED | status-view.tsx line 128: `setStudyNotes(payload.new.studyNotes ?? null)` + line 129: `setNotesSettled(true)` in Realtime handler; line 150: `.select('status, errorMessage, stitchedTranscript, videoUrl, studyNotes')` in polling fallback; line 161-162: `setStudyNotes` and `setNotesSettled(true)` on DONE |
| 13 | initialStudyNotes prop is passed from status/page.tsx to StatusView | VERIFIED | status/page.tsx line 66: `initialStudyNotes={job.studyNotes ?? null}` and line 67: `youtubeUrl={job.youtubeUrl}` passed to StatusView |
| 14 | StudyNotesPDFDocument renders topic header, notes body (Markdown-stripped), and YouTube URL footer | VERIFIED | StudyNotesPDFDocument.tsx: Title Text "Study Notes: {topic}" (line 56), body Text `{stripMarkdown(studyNotes)}` (line 60), footer Text "Source: {youtubeUrl}" (line 63); stripMarkdown() strips ##, **, *, -, ` characters |

**Score:** 13/14 truths verified (1 requires human browser testing)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `worker/src/notesGenerator.ts` | generateStudyNotes(entries, topic) — Gemini call with 1-retry backoff, soft-fail null | VERIFIED | 69 lines; exports `generateStudyNotes`; uses `@google/genai`, model `gemini-3-flash`; GEMINI_API_KEY guard; retry loop for attempts 0-1 with sleep(2000) |
| `worker/src/__tests__/notesGenerator.test.ts` | Unit tests: happy path, soft-fail, retry, missing key | VERIFIED | 70 lines; 4 tests all GREEN (4/4 pass); vi.mock for @google/genai using constructor function |
| `prisma/schema.prisma` | studyNotes String? column on Job model | VERIFIED | Line 30: `studyNotes         String?   // Phase 5: AI-generated study notes Markdown text` |
| `prisma/migrations/20260627233003_add_study_notes/migration.sql` | ALTER TABLE "Job" ADD COLUMN "studyNotes" TEXT | VERIFIED | File exists; content: `ALTER TABLE "Job" ADD COLUMN "studyNotes" TEXT;` |
| `worker/src/index.ts` | import + call after buildStitchedTranscript + studyNotes in DONE update | VERIFIED | Line 15: import; lines 96-103: call site; line 135: in DONE update payload |
| `worker/package.json` | @google/genai dependency | VERIFIED | `"@google/genai": "^2.10.0"` in dependencies |
| `src/components/StudyNotesPDFDocument.tsx` | Named export with topic header, stripped notes body, YouTube URL footer | VERIFIED | 68 lines; named export `StudyNotesPDFDocument`; no 'use client'; StyleSheet.create; stripMarkdown helper; A4 page Helvetica layout |
| `src/__tests__/status-view-notes-tab.test.tsx` | RTL tests for Notes tab three-state rendering | VERIFIED | 118 lines; 3 tests all GREEN (3/3 pass); mocks for next/dynamic and @react-pdf/renderer present |
| `src/types/job.ts` | studyNotes: string \| null on Job interface | VERIFIED | Line 60: `studyNotes:         string \| null                      // Phase 5: AI-generated Markdown study notes` |
| `src/app/globals.css` | @plugin "@tailwindcss/typography"; | VERIFIED | Line 4: `@plugin "@tailwindcss/typography";` after @import lines |
| `src/components/status-view.tsx` | Three-state Notes tab, PDFDownloadLink, Realtime/polling extension | VERIFIED | StatusViewProps includes `initialStudyNotes` and `youtubeUrl`; State A/B/C rendering at lines 293-324; PDFDownloadLink via dynamic() ssr:false at lines 22-25 |
| `src/app/status/page.tsx` | Passes initialStudyNotes and youtubeUrl to StatusView | VERIFIED | Lines 66-67: both props passed |
| `package.json` | react-markdown, @react-pdf/renderer, @tailwindcss/typography | VERIFIED | All three appear in dependencies/devDependencies |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `worker/src/index.ts` | `worker/src/notesGenerator.ts` | generateStudyNotes import + call after buildStitchedTranscript() | WIRED | Line 15: import; line 98: `const studyNotes = await generateStudyNotes(stitchedTranscript, job.topic)` — call placed after stitchedTranscript build (line 93) and before DONE update (line 127) |
| `worker/src/index.ts` | `prisma.job.update` | studyNotes field in DONE update payload | WIRED | Line 135: `studyNotes,` in update data object with explicit comment about no cast |
| `src/components/status-view.tsx` | `src/components/StudyNotesPDFDocument.tsx` | import StudyNotesPDFDocument, passed as document prop to PDFDownloadLink | WIRED | Line 17: import; line 307: `<StudyNotesPDFDocument topic={topic} studyNotes={studyNotes} youtubeUrl={youtubeUrl} />` as document prop |
| `src/components/status-view.tsx` | `@react-pdf/renderer PDFDownloadLink` | dynamic() import with ssr: false | WIRED | Lines 22-25: `const PDFDownloadLink = dynamic(() => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink), { ssr: false, loading: () => null })` |
| `src/app/status/page.tsx` | `src/components/status-view.tsx` | initialStudyNotes prop | WIRED | Line 66: `initialStudyNotes={job.studyNotes ?? null}` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `status-view.tsx` Notes tab State B | `studyNotes` (useState) | Initialized from `initialStudyNotes` prop (from `job.studyNotes` in page.tsx), then updated by Supabase Realtime and polling fallback | Yes — from Prisma Job row `studyNotes` column which is populated by `generateStudyNotes()` Gemini call in worker | FLOWING |
| `StudyNotesPDFDocument.tsx` | `studyNotes` prop + `youtubeUrl` prop | Passed from status-view.tsx State B conditional (only renders when `studyNotes !== null`) | Yes — AI-generated Markdown string from Gemini, stripped by `stripMarkdown()` before PDF Text node | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| notesGenerator unit tests (happy path, soft-fail, retry, missing key) | `cd worker && npm run test:run -- src/__tests__/notesGenerator.test.ts` | 4/4 tests pass | PASS |
| Notes tab RTL tests (State B: PDF button, no-tabs PROCESSING, State C: soft-fail message) | `npm run test:run -- src/__tests__/status-view-notes-tab.test.tsx` | 3/3 tests pass | PASS |
| Full worker test suite (no regressions) | `cd worker && npm run test:run` | 64/64 tests pass across 10 files | PASS |
| Full frontend test suite (no regressions) | `npm run test:run` | 41/41 tests pass across 6 files | PASS |
| generateStudyNotes import in worker index.ts | `grep "generateStudyNotes" worker/src/index.ts` | Found at line 15 (import) and line 98 (call) | PASS |
| studyNotes in prisma schema | `grep "studyNotes" prisma/schema.prisma` | `studyNotes         String?` at line 30 | PASS |
| gemini-3-flash model string (not deprecated variant) | `grep "gemini-3-flash" worker/src/notesGenerator.ts` | Found at line 54 | PASS |
| @google/genai SDK (not @google/generative-ai) | `grep "@google/genai" worker/src/notesGenerator.ts` | Found at line 6 (import) | PASS |
| ssr: false on PDFDownloadLink | `grep "ssr: false" src/components/status-view.tsx` | Found at line 24 | PASS |
| prose prose-neutral class on Markdown wrapper | `grep "prose prose-neutral" src/components/status-view.tsx` | Found at line 303 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NOT-01 | 05-01-PLAN.md | System can generate study notes from the selected stitched transcript spans | SATISFIED | `generateStudyNotes(entries, topic)` takes `StitchedTranscriptEntry[]`; worker calls it with `stitchedTranscript` after `buildStitchedTranscript()`; result persisted to Job row |
| NOT-02 | 05-01-PLAN.md | Study notes include clear explanations of the searched topic | SATISFIED | notesGenerator.ts buildPrompt() instructs Gemini: `## Explanation` section "A clear, plain-language explanation of '{topic}' as described in the transcript" |
| NOT-03 | 05-01-PLAN.md | Study notes include key points from the selected segments | SATISFIED | buildPrompt() instructs Gemini: `## Key Points` section "Bullet points covering the most important concepts mentioned" |
| NOT-04 | 05-01-PLAN.md | Study notes include relevant definitions when the source content supports them | SATISFIED | buildPrompt() instructs Gemini: `## Definitions` section "Define any technical terms or concepts introduced in the excerpt"; prompt explicitly says "only if the content supports them" |
| NOT-05 | 05-02-PLAN.md | User can download the study notes as a PDF | SATISFIED (HUMAN for browser behavior) | PDFDownloadLink dynamically imported with ssr:false; StudyNotesPDFDocument renders topic header + stripped notes body + YouTube URL footer; RTL test confirms "Download PDF" button renders; actual file download requires human browser test |

**Note on REQUIREMENTS.md traceability:** The REQUIREMENTS.md file marks NOT-01 through NOT-04 as `[ ]` (unchecked/Pending) and the traceability table shows them as "Pending". The implementation for all four requirements is complete and fully verified in the codebase. This is a documentation-only gap — the checkboxes and traceability table were not updated when Phase 05 delivered these requirements. NOT-05 is correctly marked `[x]` and "Complete".

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `worker/src/notesGenerator.ts` | 45, 64, 68 | `return null` | INFO | These are intentional soft-fail return paths, not stubs. Each is conditional: guard on missing API key, error catch after retry, and final fallback. All tested by unit tests. Not a stub. |
| `src/components/status-view.tsx` | — | None found | — | No TBD/FIXME/XXX/placeholder patterns; no hardcoded empty data in rendering paths |
| `src/components/StudyNotesPDFDocument.tsx` | — | None found | — | No stub indicators; no 'use client' (correct); uses StyleSheet.create (correct) |
| All other modified files | — | None found | — | Clean |

No debt markers (TBD/FIXME/XXX) found in any files modified by this phase.

---

### Human Verification Required

#### 1. PDF Download — Browser File Download

**Test:** Open the application with a completed job that has studyNotes populated (requires GEMINI_API_KEY set and migration applied). Navigate to the status page, click the "Notes" tab, then click the "Download PDF" button.

**Expected:** Browser initiates a download of a file named `study-notes-{topic}.pdf`. Opening the file in a PDF viewer shows:
- Page header: "Study Notes: {topic}" in 20pt bold Helvetica
- Body: Plain-text version of the notes (Markdown characters stripped — no `##`, `**`, `-` symbols visible)
- Footer: "Source: {youtubeUrl}" in 10pt gray text
- A4 page size, 48pt padding

**Why human:** PDFDownloadLink is a browser-only API that generates a Blob URL and triggers a `<a download>` click programmatically. This cannot be simulated in jsdom. The RTL test confirms the button renders but cannot verify the browser download trigger or the PDF content.

---

### Gaps Summary

No gaps found. All 13 automatically-verifiable must-haves pass. The single human_needed item (PDF download browser behavior) is a browser-only behavior that is architecturally correct — PDFDownloadLink with `ssr: false` and `fileName` prop is the established @react-pdf/renderer pattern.

**Documentation note (non-blocking):** REQUIREMENTS.md checkboxes and traceability table for NOT-01 through NOT-04 still show Pending despite the implementation being complete. This should be updated to reflect Phase 05 delivery.

---

_Verified: 2026-06-27T20:05:00Z_
_Verifier: Claude (gsd-verifier)_
