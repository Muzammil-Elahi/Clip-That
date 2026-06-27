# Phase 05: Study Notes and PDF - Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `worker/src/notesGenerator.ts` | service/utility | request-response (AI call) | `worker/src/stitchedTranscript.ts` + `worker/src/transcript.ts` | role-match |
| `src/components/StudyNotesPDFDocument.tsx` | component | transform (Markdown → PDF) | `src/components/status-view.tsx` (component structure) | partial |
| `src/components/status-view.tsx` | component | event-driven (Realtime) | `src/components/status-view.tsx` itself (extension) | exact |
| `src/types/job.ts` | model | — | `src/types/job.ts` itself (extension) | exact |
| `prisma/schema.prisma` | config/schema | — | `prisma/schema.prisma` itself (extension) | exact |
| `prisma/migrations/<ts>_add_study_notes/migration.sql` | migration | — | `prisma/migrations/20260626000001_add_video_url_expires_at/migration.sql` | exact |
| `worker/src/__tests__/notesGenerator.test.ts` | test | — | `worker/src/__tests__/stitchedTranscript.test.ts` | exact |
| `src/__tests__/status-view-notes-tab.test.tsx` | test | — | `src/__tests__/status-view-video-tab.test.tsx` | exact |

---

## Pattern Assignments

### `worker/src/notesGenerator.ts` (service/utility, request-response)

**Analogs:** `worker/src/stitchedTranscript.ts` (module structure) + `worker/src/transcript.ts` (error handling)

**Imports pattern** — copy from `worker/src/stitchedTranscript.ts` lines 1–7, adapted:
```typescript
import { GoogleGenAI } from '@google/genai'
import type { StitchedTranscriptEntry } from './types.js'
```

**Module header pattern** — copy from `worker/src/stitchedTranscript.ts` lines 1–3:
```typescript
/**
 * Study notes generation for Phase 5.
 * Single exported function — no side effects beyond the Gemini API call.
 */
```

**Core pattern** — single exported async function, soft-fail return type `string | null`, retry loop with sleep. Copy sleep helper from `worker/src/index.ts` line 37:
```typescript
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))
```

**Env guard pattern** — do NOT use `process.exit(1)` for missing key (unlike `worker/src/index.ts` lines 27–30 which exits on missing DB URL). Missing `GEMINI_API_KEY` is a soft-fail, not fatal:
```typescript
// At top of generateStudyNotes():
if (!process.env.GEMINI_API_KEY) {
  console.warn('  GEMINI_API_KEY not set — skipping note generation (soft-fail)')
  return null
}
```

**Error handling pattern** — log with `console.warn` on attempt 1, `console.error` on final failure. Copy logging style from `worker/src/index.ts` lines 83–93 (`console.log('  fetching transcript...')`). Do NOT use `mapTranscriptError()` — soft-fail returns null, not an error string.

**Integration point** — insert after line 93 of `worker/src/index.ts` (`buildStitchedTranscript`) and before line 116 (`writing DONE...`). Copy the `console.log('  ...')` indented style from lines 83–113:
```typescript
// After: const stitchedTranscript = buildStitchedTranscript(...)
console.log('  generating study notes...')
const studyNotes = await generateStudyNotes(stitchedTranscript, job.topic)
if (studyNotes) {
  console.log('  study notes generated ✓')
} else {
  console.log('  study notes soft-failed (null) — job will still complete')
}
```

**DONE update** — add `studyNotes` to `prisma.job.update()` at `worker/src/index.ts` lines 117–127. Unlike `transcript`/`clipPlan`/`stitchedTranscript` (which need `as unknown as Prisma.InputJsonValue`), `studyNotes` is `Text?` so pass as plain `string | null` — no cast:
```typescript
data: {
  transcript: segments as unknown as Prisma.InputJsonValue,
  clipPlan: clipPlan as unknown as Prisma.InputJsonValue,
  stitchedTranscript: stitchedTranscript as unknown as Prisma.InputJsonValue,
  videoUrl,
  videoExpiresAt: videoUrl ? new Date(Date.now() + RETENTION_MS) : null,
  studyNotes,        // string | null — no cast needed for Text? column
  status: 'DONE',
},
```

---

### `src/components/StudyNotesPDFDocument.tsx` (component, transform)

**Analog:** `src/components/status-view.tsx` lines 1–14 (imports, `'use client'` directive, named exports)

**No `'use client'` needed** — this component uses only `@react-pdf/renderer` primitives, not browser hooks. It can be imported directly.

**Imports pattern:**
```typescript
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
```

**Props interface pattern** — copy naming convention from `src/components/status-view.tsx` lines 38–46 (interface above the component):
```typescript
interface StudyNotesPDFDocumentProps {
  topic: string
  studyNotes: string
  youtubeUrl: string
}
```

**Export pattern** — named export (not default), matching `src/components/status-view.tsx`'s `export default function StatusView`. Use named export since it's consumed via dynamic import:
```typescript
export function StudyNotesPDFDocument({ topic, studyNotes, youtubeUrl }: StudyNotesPDFDocumentProps) {
```

**Styling pattern** — use `StyleSheet.create()` at module level (mirrors Tailwind class objects declared outside component in status-view.tsx). Built-in `Helvetica` font; no custom font loading needed for MVP.

**Markdown strip** — lightweight regex function, not an imported library. Declared as a module-level helper (same pattern as `formatTimestamp` in `status-view.tsx` lines 32–36).

---

### `src/components/status-view.tsx` (component, event-driven — MODIFY)

**Analog:** itself — extend existing patterns at these exact locations.

**New prop** — add `initialStudyNotes: string | null` to `StatusViewProps` interface (lines 38–46), following the `initialVideoUrl: string | null` entry at line 45:
```typescript
initialStudyNotes: string | null   // Phase 5
```

**New state** — add two `useState` calls after `videoUrl` state (line 78), following the Phase 4 comment pattern:
```typescript
const [studyNotes, setStudyNotes] = useState<string | null>(initialStudyNotes ?? null) // Phase 5
const [notesSettled, setNotesSettled] = useState(initialStatus === JobStatus.DONE)      // Phase 5
```

**Realtime handler extension** — extend the `payload` destructure inside the `.on(...)` callback (lines 106–112). Copy exact pattern of `setVideoUrl(payload.new.videoUrl ?? null)` at line 110:
```typescript
setStudyNotes(payload.new.studyNotes ?? null)   // Phase 5
setNotesSettled(true)                            // Phase 5
```

**Polling fallback extension** — extend the `select()` call at line 131 and the state updates at lines 139–141. Copy exact pattern of `videoUrl` addition:
```typescript
.select('status, errorMessage, stitchedTranscript, videoUrl, studyNotes')
// ...
setStudyNotes(row.studyNotes ?? null)                         // Phase 5
if (row.status === JobStatus.DONE) setNotesSettled(true)      // Phase 5
```

**Dynamic import for PDFDownloadLink** — add after the existing imports, using `next/dynamic`. Place near top of file after `import { cn }`:
```typescript
import dynamic from 'next/dynamic'
import { StudyNotesPDFDocument } from './StudyNotesPDFDocument'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false, loading: () => null }
)
```

**Notes tab content** — replace the placeholder at lines 272–275 with three-state conditional. Copy the three-state Video tab pattern at lines 238–252 exactly:
- State A (`!notesSettled && studyNotes === null`): loading text — matches Video tab "Working on it..." pattern
- State B (`studyNotes !== null`): `<Markdown>` with `prose` class + `<PDFDownloadLink>` button
- State C (`notesSettled && studyNotes === null`): soft-fail paragraph — matches Video tab "No clips found" pattern

**`react-markdown` usage** — wrap in `<div className="prose prose-neutral max-w-none">`:
```typescript
import Markdown from 'react-markdown'
// In JSX:
<div className="prose prose-neutral max-w-none">
  <Markdown>{studyNotes}</Markdown>
</div>
```

**Button pattern** — copy `<Button>` usage from lines 289–295 (the "Try again" button). Use `variant="default"` and the `<Download>` icon from `lucide-react` (already imported in the project via shadcn).

---

### `src/types/job.ts` (model — MODIFY)

**Analog:** itself — add one field after `videoExpiresAt` at line 59, following the exact comment style of Phase 4 additions:
```typescript
studyNotes:     string | null                      // Phase 5: AI-generated Markdown study notes
```

---

### `prisma/schema.prisma` (config/schema — MODIFY)

**Analog:** itself — add one field after `videoExpiresAt` at line 29, following the Phase 4 comment style:
```prisma
studyNotes         String?   // Phase 5: AI-generated study notes Markdown text
```

Note: `String?` maps to `TEXT` in PostgreSQL. No `Json?` — no `Prisma.InputJsonValue` cast in the worker.

---

### `prisma/migrations/<timestamp>_add_study_notes/migration.sql` (migration — NEW)

**Analog:** `prisma/migrations/20260626000001_add_video_url_expires_at/migration.sql` (lines 1–4) — exact same structure. Generated by `prisma migrate dev`; do not hand-write unless running in CI without interactive Prisma.

Expected SQL (for reference — let Prisma generate the actual file):
```sql
-- AlterTable
ALTER TABLE "Job" ADD COLUMN "studyNotes" TEXT;
```

---

### `worker/src/__tests__/notesGenerator.test.ts` (test — NEW)

**Analog:** `worker/src/__tests__/stitchedTranscript.test.ts` (lines 1–5, overall structure)

**Imports pattern** (copy from `stitchedTranscript.test.ts` lines 1–4):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateStudyNotes } from '../notesGenerator.js'
import type { StitchedTranscriptEntry } from '../types.js'
```

**Mock pattern** — mock `@google/genai` at module level. This is the worker test equivalent of `vi.mock('@/lib/supabase/client', ...)` pattern in frontend tests:
```typescript
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn(),
    },
  })),
}))
```

**Test structure** — `describe` + `it` blocks with `expect`. Copy from `stitchedTranscript.test.ts` lines 6–92. Test cases: happy path returns string, Gemini throws → soft-fail returns null, retry: first call throws + second succeeds → returns string.

---

### `src/__tests__/status-view-notes-tab.test.tsx` (test — NEW)

**Analog:** `src/__tests__/status-view-video-tab.test.tsx` (entire file, lines 1–93)

**Mocks block** — copy lines 17–36 exactly (next/navigation + supabase/client mocks). These are required for all StatusView tests.

**Additional mock for PDFDownloadLink** (add after existing mocks):
```typescript
vi.mock('next/dynamic', () => ({
  default: (_fn: unknown) =>
    function MockPDFDownloadLink({ children }: { children: (s: { loading: boolean }) => React.ReactNode }) {
      return <>{children({ loading: false })}</>
    },
}))
vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }: { children: (s: { loading: boolean }) => React.ReactNode }) =>
    <>{children({ loading: false })}</>,
  Document: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Page: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  View: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Text: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StyleSheet: { create: (s: unknown) => s },
}))
```

**`defaultProps` pattern** — copy from `status-view-video-tab.test.tsx` lines 38–46, extend with `initialStudyNotes`:
```typescript
const defaultProps = {
  userId: 'user-1',
  initialStatus: 'DONE',
  initialJobId: 'job-1',
  initialErrorMessage: null,
  initialStitchedTranscript: [{ sourceStartMs: 0, sourceEndMs: 5000, text: 'hello' }],
  initialVideoUrl: null,
  initialStudyNotes: null,
  topic: 'photosynthesis',
}
```

**Tab activation helper** — copy `clickVideoTab()` pattern (lines 48–52), adapted:
```typescript
function clickNotesTab() {
  const notesTabBtn = screen.getByRole('tab', { name: /notes/i })
  fireEvent.click(notesTabBtn)
}
```

**Test cases** — three states:
1. `initialStudyNotes: 'some notes'` + `initialStatus: 'DONE'` → "Download PDF" button visible
2. `initialStudyNotes: null` + `initialStatus: 'PROCESSING'` (notesSettled=false) → "Generating your study notes..." visible
3. `initialStudyNotes: null` + `initialStatus: 'DONE'` (notesSettled=true) → soft-fail message visible

---

### `src/app/globals.css` (config — MODIFY)

**Analog:** itself. Add one line after existing `@import` lines (Tailwind v4 CSS-first config pattern):
```css
@plugin "@tailwindcss/typography";
```

This is a Tailwind v4 pattern — do NOT add to `tailwind.config.js`.

---

## Shared Patterns

### Worker Module Structure
**Source:** `worker/src/stitchedTranscript.ts` lines 1–30
**Apply to:** `worker/src/notesGenerator.ts`
- JSDoc block at top describing the module
- Single named export function
- `.js` extension on all local imports (ESM requirement in worker)
- Pure module, no class wrappers

### Worker Console Logging Style
**Source:** `worker/src/index.ts` lines 83–93
**Apply to:** `worker/src/notesGenerator.ts` (internal) and `worker/src/index.ts` (integration callsite)
```typescript
console.log('  fetching transcript...')   // 2-space indent, present participle
console.log(`  got ${n} segments`)        // 2-space indent, past tense result
console.warn('  ...failed, retrying...')  // warn for recoverable
console.error('  ERROR:', err)            // error for non-recoverable
```

### Realtime State Update Pattern
**Source:** `src/components/status-view.tsx` lines 106–112
**Apply to:** Extension of the same file for `studyNotes` and `notesSettled`
```typescript
// Inside .on(..., (payload: any) => { ... })
setStatus(payload.new.status)
setErrorMessage(payload.new.errorMessage ?? null)
setStitchedTranscript(parseStitchedTranscript(payload.new.stitchedTranscript))
setVideoUrl(payload.new.videoUrl ?? null)    // Phase 4 — copy this pattern
// setStudyNotes(payload.new.studyNotes ?? null)  // Phase 5 — add here
```

### Tab Content Three-State Pattern
**Source:** `src/components/status-view.tsx` lines 237–252 (Video tab)
**Apply to:** Notes tab at lines 272–276
The Video tab has three states (no-matches / video-ready / still-loading). The Notes tab mirrors this exactly:
```typescript
{/* State A: loading */}
{!notesSettled && studyNotes === null && (
  <p className="text-base text-muted-foreground">Generating your study notes...</p>
)}
{/* State B: notes available */}
{studyNotes !== null && ( ... )}
{/* State C: soft-fail */}
{notesSettled && studyNotes === null && (
  <p className="text-base text-muted-foreground">
    Notes could not be generated. Your video and transcript are still available.
  </p>
)}
```

### Prisma Text Column (no cast)
**Source:** `worker/src/index.ts` lines 117–127 — `videoUrl` field (line 123) is `String?` and passed without cast
**Apply to:** `studyNotes` in the same update block
**Anti-pattern to avoid:** `as unknown as Prisma.InputJsonValue` — that cast applies only to `Json?` columns (`transcript`, `clipPlan`, `stitchedTranscript`).

### StatusView Test Mocks
**Source:** `src/__tests__/status-view-video-tab.test.tsx` lines 17–36
**Apply to:** `src/__tests__/status-view-notes-tab.test.tsx` — copy verbatim as the base mock block, then add PDF mocks on top.

---

## No Analog Found

All files have close analogs in the codebase. No entries in this section.

---

## Metadata

**Analog search scope:** `worker/src/`, `src/components/`, `src/types/`, `src/__tests__/`, `worker/src/__tests__/`, `prisma/`
**Files read:** 12 source files
**Pattern extraction date:** 2026-06-26
