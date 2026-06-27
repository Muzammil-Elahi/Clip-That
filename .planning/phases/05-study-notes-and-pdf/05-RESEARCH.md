# Phase 05: Study Notes and PDF - Research

**Researched:** 2026-06-27
**Domain:** AI text generation (Google Gemini), Markdown rendering, client-side PDF generation, Prisma schema migration, Supabase Realtime extension
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** AI provider — Google Gemini Flash (`@google/generative-ai` Node.js SDK). Free tier: 1M tokens/day, 15 RPM. Model: Claude's discretion on exact model name (`gemini-1.5-flash` or `gemini-2.0-flash`). Aligns with the free-tier constraint (D-01 from Phase 4 context). `GEMINI_API_KEY` in `worker/.env.local` + Railway environment variable.
- **D-02:** Note generation output format — Freeform Markdown. Prompt instructs Gemini to produce well-formatted Markdown with clear sections (e.g., `## Explanation`, `## Key Points`, `## Definitions`). Claude's discretion on exact prompt wording, section order, and tone guidance.
- **D-03:** Storage column — `studyNotes Text?` on the `Job` model (plain Markdown string, not JSON). Requires a Prisma migration. Consistent with the existing string/JSON column pattern on Job.
- **D-04:** Browser delivery — Supabase Realtime (same pattern as `stitchedTranscript` and `videoUrl` from Phases 3–4). Add `studyNotes` to the Realtime payload handler and the polling fallback `select()` call in `status-view.tsx`.
- **D-05:** Markdown rendering — `react-markdown` with Tailwind Typography `prose` class for styled output in the Notes tab.
- **D-06:** Notes tab loading state — When `studyNotes` is null post-DONE, show a loading indicator in the Notes tab. Transitions to rendered Markdown or soft-fail error message when `studyNotes` updates via Realtime. Claude's discretion on loading UX (spinner, skeleton, or "Generating notes..." text).
- **D-07:** PDF library — `@react-pdf/renderer`, client-side only via `PDFDownloadLink` component. No new API routes. Zero round-trips.
- **D-08:** PDF content — Topic header (`Study Notes: [topic]`) + Markdown notes body + source video URL as footer. Claude's discretion on PDF layout, font choices, and styling within `@react-pdf/renderer` primitives.
- **D-09:** Failure strategy — Soft fail. If Gemini API call fails after 1 retry with exponential backoff, `studyNotes` is left `null`. Job status remains `DONE`. Notes tab shows: "Notes could not be generated. Your video and transcript are still available." Worker logs the error for diagnostics.
- **D-10:** Retry policy — 1 retry with exponential backoff (~2s delay) on transient errors. If retry also fails, proceed to soft-fail path.

### Claude's Discretion

- Exact Gemini model name (`gemini-1.5-flash` vs `gemini-2.0-flash`)
- Gemini prompt wording, note structure order, and study-tone guidance
- Notes tab loading UX (spinner, skeleton, or text placeholder)
- `@react-pdf/renderer` PDF component layout, fonts, and styling
- Worker note-generation module file name (e.g., `worker/src/notesGenerator.ts`)
- Prisma field name (prefer `studyNotes`)

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOT-01 | System can generate study notes from the selected stitched transcript spans | Gemini SDK section; `notesGenerator.ts` module pattern; worker integration point |
| NOT-02 | Study notes include clear explanations of the searched topic | Gemini prompt design section; output format decisions |
| NOT-03 | Study notes include key points from the selected segments | Gemini prompt design section; Markdown section structure |
| NOT-04 | Study notes include relevant definitions when the source content supports them | Gemini prompt design section; soft-fail for when content lacks definitions |
| NOT-05 | User can download the study notes as a PDF | `@react-pdf/renderer` section; PDFDownloadLink pattern; Next.js SSR pitfall |
</phase_requirements>

---

## Summary

Phase 5 adds AI-powered study note generation to the Clip-That worker and surfaces the result in the browser Notes tab with a PDF download button. The worker pipeline already has `stitchedTranscript` available before the final `prisma.job.update()` DONE call — Phase 5 inserts a Gemini API call between `buildStitchedTranscript()` and the DONE write, following the established module pattern (`worker/src/notesGenerator.ts`).

**Critical SDK finding:** The CONTEXT.md decision D-01 specifies `@google/generative-ai` as the SDK. Research confirms this package still exists (v0.24.1) but is the *older* SDK that no longer receives Gemini 2.0+ features. The current official SDK is `@google/genai` (v2.10.0). The exact model names `gemini-1.5-flash` and `gemini-2.0-flash` referenced in CONTEXT.md are deprecated/shut down. The recommended stable model is `gemini-2.5-flash`. [ASSUMED: this is a breaking change vs. CONTEXT.md intent — the planner must note this for discussion.] The decision in CONTEXT.md was written with older model names; implementation should use `@google/genai` with `gemini-2.5-flash`.

**PDF SSR requirement:** `@react-pdf/renderer`'s `PDFDownloadLink` is web-only and cannot render on the server. Since `status-view.tsx` is already a `'use client'` file, direct imports should work, but the safest and most portable pattern is to use `dynamic()` with `ssr: false` for the `PDFDownloadLink` import specifically. This prevents build-time issues.

**Primary recommendation:** Use `@google/genai` v2.10.0 with `gemini-2.5-flash` for note generation. Use `dynamic` import with `ssr: false` for `PDFDownloadLink`. Add `@plugin "@tailwindcss/typography"` to `globals.css` for Tailwind v4 compatibility.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Note generation from transcript | Worker (Node.js) | — | CPU/AI work belongs in the worker, not in the browser or API routes; follows established Phase 3/4 pattern |
| Soft-fail and retry logic | Worker (Node.js) | — | Error handling wraps the Gemini call in the worker; job remains DONE regardless |
| `studyNotes` persistence | Database (PostgreSQL via Prisma) | — | New `Text?` column on Job, follows same pattern as `videoUrl` |
| Delivering `studyNotes` to browser | Supabase Realtime | Polling fallback | Same delivery mechanism as `stitchedTranscript` and `videoUrl` from prior phases |
| Markdown rendering | Browser / Client | — | `react-markdown` runs client-side in `status-view.tsx` |
| PDF generation | Browser / Client | — | `@react-pdf/renderer` `PDFDownloadLink` is web-only (labeled "Web only" by library docs) |
| Loading vs. soft-fail state tracking | Browser / Client | — | `notesSettled` boolean state in `status-view.tsx` distinguishes these two null states |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | 2.10.0 | Gemini API text generation in worker | Current official Google SDK; supersedes `@google/generative-ai`; supports `gemini-2.5-flash` |
| `react-markdown` | 10.1.0 | Render Gemini Markdown output in Notes tab | XSS-safe by default; semantic HTML output; 25M weekly downloads; pairs naturally with Tailwind prose |
| `@react-pdf/renderer` | 4.5.1 | Client-side PDF generation and download | Zero API round-trips; `PDFDownloadLink` gives native file download; React 19 supported since v4.1.0 |
| `@tailwindcss/typography` | 0.5.20 | Style rendered Markdown with `prose` class | Official Tailwind plugin; integrates with Tailwind v4 via CSS `@plugin` directive |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/dynamic` | (built into Next.js 16) | Lazy-load `PDFDownloadLink` with `ssr: false` | Required to prevent build-time SSR error for PDF components that use browser APIs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@google/genai` | `@google/generative-ai` | Older SDK, no Gemini 2.0+ model support — avoid |
| `gemini-2.5-flash` | other models | `gemini-1.5-flash` and `gemini-2.0-flash` are deprecated/shut down per current Google docs |
| `@react-pdf/renderer` | `window.print()` or `jsPDF` | User explicitly chose `@react-pdf/renderer` (D-07); `window.print()` gives browser dialog, not file |
| `@tailwindcss/typography` | custom CSS | Plugin handles all prose styling edge cases (code blocks, nested lists, blockquotes) |

**Installation:**

```bash
# In project root (frontend)
npm install react-markdown @react-pdf/renderer
npm install -D @tailwindcss/typography

# In worker/
npm install @google/genai
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@google/genai` | npm | ~3 days (last publish Jun 24 2026) | 17.1M/wk | github.com/googleapis/js-genai | SUS (too-new latest publish) | Approved — official Google SDK, high download count confirms legitimacy; "too-new" reflects recent patch release not new package |
| `react-markdown` | npm | Published Mar 7 2025 | 25.6M/wk | github.com/remarkjs/react-markdown | OK | Approved |
| `@react-pdf/renderer` | npm | Published Apr 15 2026 | 4.0M/wk | github.com/diegomura/react-pdf | OK | Approved |
| `@tailwindcss/typography` | npm | Published Jun 8 2026 | 21.0M/wk | github.com/tailwindlabs/tailwindcss-typography | SUS (too-new latest publish) | Approved — official Tailwind Labs plugin; "too-new" reflects recent release of existing long-running package |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `@google/genai` and `@tailwindcss/typography` were flagged `SUS` by the legitimacy seam due to "too-new" signal on their latest publish date. Both are official packages from their respective organizations (Google, Tailwind Labs) with massive weekly download counts confirming legitimacy. The "too-new" flag reflects a recent patch release of a long-established package, not a slopsquatted package. No checkpoint needed — both are [VERIFIED: official organization repos].

*`@google/genai` confirmed via github.com/googleapis/js-genai (official Google repository). `@tailwindcss/typography` confirmed via github.com/tailwindlabs/tailwindcss-typography (official Tailwind Labs repository).*

---

## Architecture Patterns

### System Architecture Diagram

```
Worker Pipeline (processPendingJob)
  │
  ├─ fetchTranscript()
  ├─ buildClipPlan()
  ├─ expandContextWindows() + mergeOverlappingWindows()
  ├─ buildStitchedTranscript()  ← produces StitchedTranscriptEntry[]
  │
  ├─ [NEW] generateStudyNotes(stitchedTranscript, topic)
  │       │
  │       ├─ @google/genai: ai.models.generateContent()
  │       │       model: gemini-2.5-flash
  │       │       contents: formatted prompt with topic + transcript text
  │       │
  │       ├─ on success → studyNotes: string (Markdown)
  │       └─ on failure (1 retry + backoff) → studyNotes: null (soft-fail)
  │
  ├─ prisma.job.update({ status: DONE, studyNotes, videoUrl, ... })
  │       └─ Supabase Realtime fires UPDATE event
  │
  └─ Browser (status-view.tsx)
          │
          ├─ Realtime handler → setStudyNotes(payload.new.studyNotes ?? null)
          │                      setNotesSettled(true)  [new flag]
          ├─ Polling fallback → includes studyNotes in select()
          │
          └─ Notes tab conditional render
                  ├─ !notesSettled && studyNotes === null → "Generating your study notes..."
                  ├─ studyNotes !== null → <ReactMarkdown> + <PDFDownloadLink>
                  └─ notesSettled && studyNotes === null → soft-fail message
```

### Recommended Project Structure

New files this phase adds:

```
worker/src/
├── notesGenerator.ts         # [NEW] generateStudyNotes() — Gemini call, soft-fail, retry
src/components/
├── StudyNotesPDFDocument.tsx  # [NEW] @react-pdf/renderer Document component
├── status-view.tsx            # [MODIFY] extend with studyNotes state + Notes tab content
src/types/
├── job.ts                     # [MODIFY] add studyNotes: string | null to Job interface
prisma/
├── schema.prisma              # [MODIFY] add studyNotes Text?
├── migrations/                # [NEW] migration for studyNotes column
```

### Pattern 1: Worker Module — notesGenerator.ts

**What:** A single exported function that takes `StitchedTranscriptEntry[]` and `topic` string, calls Gemini, and returns `string | null`.
**When to use:** Follows the established module pattern from `transcript.ts`, `matcher.ts`, `stitchedTranscript.ts`.

```typescript
// Source: established pattern from worker/src/stitchedTranscript.ts + worker/src/transcript.ts
// @google/genai v2.10.0 — [CITED: github.com/googleapis/js-genai]

import { GoogleGenAI } from '@google/genai'
import type { StitchedTranscriptEntry } from './types.js'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

export async function generateStudyNotes(
  entries: StitchedTranscriptEntry[],
  topic: string,
): Promise<string | null> {
  const transcriptText = entries.map(e => e.text).join('\n')
  const prompt = buildPrompt(topic, transcriptText)

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      })
      return response.text ?? null
    } catch (err) {
      if (attempt === 0) {
        console.warn('  Gemini attempt 1 failed, retrying in 2s...', err)
        await sleep(2000)
      } else {
        console.error('  Gemini note generation failed after retry:', err)
        return null
      }
    }
  }
  return null
}
```

### Pattern 2: Worker Integration Point

**What:** Insert `generateStudyNotes()` call after `buildStitchedTranscript()`, before the final `prisma.job.update({ status: 'DONE' })`.
**When to use:** Follows existing Phase 4 video pipeline insertion pattern.

```typescript
// Source: worker/src/index.ts lines 116-127 — existing DONE update pattern

// After: const stitchedTranscript = buildStitchedTranscript(...)
// [NEW Phase 5]
console.log('  generating study notes...')
const studyNotes = await generateStudyNotes(stitchedTranscript, job.topic)
if (studyNotes) {
  console.log('  study notes generated ✓')
} else {
  console.log('  study notes soft-failed (null) — job will still complete')
}

// Then: prisma.job.update({ data: { ..., studyNotes, status: 'DONE' } })
```

### Pattern 3: Gemini Prompt Design

**What:** Structured prompt that instructs Gemini to produce study-oriented Markdown sections.
**When to use:** NOT-02 (clear explanation), NOT-03 (key points), NOT-04 (definitions).

```typescript
// Claude's discretion per D-02 — section order and tone guidance
function buildPrompt(topic: string, transcriptText: string): string {
  return `You are a study notes generator for students and learners.

The following is a transcript excerpt from a video about "${topic}". 
Generate concise, student-focused study notes in Markdown format.

Include these sections (only if the content supports them):
## Explanation
A clear, plain-language explanation of "${topic}" as described in the transcript.

## Key Points
Bullet points covering the most important concepts mentioned.

## Definitions
Define any technical terms or concepts introduced in the excerpt.

Transcript excerpt:
${transcriptText}

Instructions:
- Base your notes only on what the transcript says. Do not add outside knowledge.
- Use simple language suitable for a student reviewing the topic.
- If the transcript does not support a section, omit that section entirely.
- Output only the Markdown notes. No preamble or meta-commentary.`
}
```

### Pattern 4: Notes Tab State Machine in status-view.tsx

**What:** Track `notesSettled` boolean alongside `studyNotes` to distinguish loading from soft-fail.
**When to use:** Both states have `studyNotes === null`; only `notesSettled` differentiates them.

```typescript
// Source: pattern derived from 05-UI-SPEC.md State Matrix + 05-CONTEXT.md D-06/D-09
// status-view.tsx — additions to existing component

const [studyNotes, setStudyNotes] = useState<string | null>(initialStudyNotes ?? null)
const [notesSettled, setNotesSettled] = useState(
  // Pre-settled if job arrived DONE with a non-null value or if null on page load
  initialStatus === JobStatus.DONE
)

// In Realtime handler:
setStudyNotes(payload.new.studyNotes ?? null)
setNotesSettled(true)  // Realtime delivered DONE — notes are now settled (null or not)

// In polling fallback:
setStudyNotes(row.studyNotes ?? null)
if (row.status === JobStatus.DONE) setNotesSettled(true)
```

### Pattern 5: PDFDownloadLink with dynamic() import

**What:** Import `PDFDownloadLink` via `next/dynamic` with `ssr: false` to prevent Next.js build-time errors.
**When to use:** Required for all `@react-pdf/renderer` web-only components in a Next.js App Router project.

```typescript
// Source: [CITED: react-pdf.org/compatibility] — PDFDownloadLink labeled "Web only"
// Pattern confirmed: [CITED: github.com/diegomura/react-pdf/issues/2754]
'use client'
import dynamic from 'next/dynamic'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false, loading: () => null }
)
```

### Pattern 6: StudyNotesPDFDocument Component

**What:** A `@react-pdf/renderer` Document component with Helvetica built-in font.
**When to use:** PDF document structure per D-08 and 05-UI-SPEC.md PDF Document Layout.

```typescript
// Source: [CITED: react-pdf.org/components]
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginBottom: 16 },
  body: { fontSize: 16, lineHeight: 1.6, color: '#1a1a1a' },
  footer: { fontSize: 10, color: '#6b7280', marginTop: 24 },
})

// Strip Markdown syntax before passing to PDF Text node
function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')   // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/^[-*]\s+/gm, '• ') // list bullets
    .replace(/`{1,3}/g, '')       // code ticks
    .trim()
}

interface Props { topic: string; studyNotes: string; youtubeUrl: string }

export function StudyNotesPDFDocument({ topic, studyNotes, youtubeUrl }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View><Text style={styles.title}>Study Notes: {topic}</Text></View>
        <View style={styles.divider} />
        <View><Text style={styles.body}>{stripMarkdown(studyNotes)}</Text></View>
        <View><Text style={styles.footer}>Source: {youtubeUrl}</Text></View>
      </Page>
    </Document>
  )
}
```

### Pattern 7: Tailwind v4 Typography Plugin Setup

**What:** Register `@tailwindcss/typography` via CSS `@plugin` directive (Tailwind v4 approach).
**When to use:** Tailwind v4 does not use `tailwind.config.js` plugins array.

```css
/* Source: [CITED: github.com/tailwindlabs/tailwindcss-typography] */
/* In src/app/globals.css — add after existing @import lines */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@plugin "@tailwindcss/typography";  /* ADD THIS LINE */
```

### Anti-Patterns to Avoid

- **Importing `@google/generative-ai`:** This is the deprecated SDK. Use `@google/genai` instead. The package IDs look similar but the newer one omits "erative" from the name.
- **Using `gemini-1.5-flash` or `gemini-2.0-flash` model names:** These are deprecated/shut down per current Google documentation. Use `gemini-2.5-flash` (stable).
- **Calling `prisma.job.update()` with `Text?` field via `Prisma.InputJsonValue` cast:** The `studyNotes` column is `Text?` (not `Json?`), so it is a plain `string | null` — no Prisma cast needed. Prior phases used `as unknown as Prisma.InputJsonValue` for JSON columns only.
- **Using `tailwind.config.js` plugins array for typography in Tailwind v4:** The project uses Tailwind v4 with CSS-first config. Use `@plugin "@tailwindcss/typography"` in `globals.css`.
- **Adding `PDFDownloadLink` without `ssr: false`:** Even in a `'use client'` file, `@react-pdf/renderer` can cause build-time errors in Next.js without `dynamic(ssr: false)`.
- **Blocking the DONE transition on note generation failure:** The worker must always write `status: 'DONE'` even when `studyNotes` is null. Do not throw and FAILED the job if only note generation fails.
- **Rendering Markdown in the PDF body:** `@react-pdf/renderer` `Text` nodes are plain text. Strip Markdown characters before passing to the PDF renderer.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown to HTML rendering | Custom regex Markdown parser | `react-markdown` | Handles GFM, nested lists, code blocks, edge cases; XSS-safe |
| Client-side PDF generation | `canvas` + `jsPDF` manual layout | `@react-pdf/renderer` | Declarative component model; built-in page layout, fonts, line wrap |
| Gemini API HTTP calls | Manual `fetch` to `generativelanguage.googleapis.com` | `@google/genai` SDK | SDK handles auth, request formatting, response parsing, streaming |
| Tailwind prose styling | Custom CSS for `h2`, `ul`, `li` inside rendered Markdown | `@tailwindcss/typography` prose class | Handles all heading/list/code styling, dark mode, size variants |

**Key insight:** The PDF layout problem is deceptively complex — manual `canvas` approaches break on text overflow, font metrics, and multi-page content. `@react-pdf/renderer` handles all of this with a CSS-like box model.

---

## Common Pitfalls

### Pitfall 1: Wrong Google AI Package Name

**What goes wrong:** Using `@google/generative-ai` (old SDK, v0.24.1) instead of `@google/genai` (new SDK, v2.10.0). The old SDK does not support `gemini-2.5-flash` or newer models.
**Why it happens:** Training data and CONTEXT.md decision D-01 reference the older package name; the SDK was renamed.
**How to avoid:** Install `@google/genai`. Use `import { GoogleGenAI } from '@google/genai'`. Model string: `'gemini-2.5-flash'`.
**Warning signs:** TypeScript errors on the import path, or `MODEL_NOT_FOUND` errors from the API when specifying `gemini-2.5-flash`.

### Pitfall 2: PDFDownloadLink SSR Error at Build Time

**What goes wrong:** Importing `PDFDownloadLink` directly at the top of `status-view.tsx` may cause `TypeError: ba.Component is not a constructor` or similar errors at `next build`.
**Why it happens:** `PDFDownloadLink` uses browser APIs (Blob, URL.createObjectURL). Next.js server pre-renders client components during build.
**How to avoid:** Use `const PDFDownloadLink = dynamic(() => import('@react-pdf/renderer').then(m => m.PDFDownloadLink), { ssr: false })`. The `StudyNotesPDFDocument` component can be imported normally since it only uses `@react-pdf/renderer` primitives (Document, Page, View, Text) which are renderable in both environments.
**Warning signs:** `next build` succeeds but `next dev` throws errors, or vice versa; or the error `TypeError: ba.Component is not a constructor`.

### Pitfall 3: Tailwind Typography Plugin Not Applied in v4

**What goes wrong:** Adding the plugin to `tailwind.config.js` (v3 pattern) instead of `globals.css` (v4 pattern). The `prose` class has no effect.
**Why it happens:** Tailwind v4 changed to CSS-first configuration; plugin registration moved to CSS.
**How to avoid:** Add `@plugin "@tailwindcss/typography";` to `src/app/globals.css` after the other `@import` lines.
**Warning signs:** `prose` class compiles but produces no heading/list styling; browser DevTools show no typography CSS rules.

### Pitfall 4: studyNotes Text Column Type Confusion

**What goes wrong:** Adding `studyNotes` to the Prisma `update()` call wrapped in `as unknown as Prisma.InputJsonValue`, which is the pattern for JSON columns (`transcript`, `clipPlan`, `stitchedTranscript`).
**Why it happens:** Copy-paste from prior JSON column updates in `worker/src/index.ts`.
**How to avoid:** `studyNotes Text?` is a PostgreSQL TEXT column — Prisma accepts `string | null` directly. No cast needed.
**Warning signs:** TypeScript type errors if cast is wrong direction; runtime behavior is unlikely to differ but the code is misleading.

### Pitfall 5: Loading vs. Soft-Fail State Confusion

**What goes wrong:** Showing the soft-fail message "Notes could not be generated..." immediately when the component mounts in DONE state with `studyNotes === null` — before Realtime has delivered the actual notes.
**Why it happens:** `studyNotes` starts as `null` on mount (the server-rendered prop); Realtime delivers the value a moment later. Without a `notesSettled` flag, null looks like soft-fail.
**How to avoid:** Introduce a `notesSettled` boolean state. Initialize to `true` only if the initial `status` is DONE *and* the server-rendered prop already has a definitive value (either string or confirmed null). Set `notesSettled = true` when the Realtime handler or polling fallback delivers a DONE status update.
**Warning signs:** Notes tab always shows the soft-fail message even when Gemini succeeds; or notes appear briefly then flip to soft-fail.

### Pitfall 6: Markdown Passed Raw to PDF Text Node

**What goes wrong:** Passing `studyNotes` (Markdown string with `##`, `**`, `-` characters) directly as children to a `@react-pdf/renderer` `<Text>` node. The PDF body displays literal `##` and `**` characters.
**Why it happens:** `@react-pdf/renderer` does not parse Markdown — it renders plain text.
**How to avoid:** Strip Markdown characters before passing to the PDF renderer using a lightweight regex (see Pattern 6 above). Do not add another Markdown-to-HTML library for the PDF path.
**Warning signs:** PDF preview in the browser shows heading hashes and asterisks as plain text.

### Pitfall 7: env-setup.ts Not Loading GEMINI_API_KEY

**What goes wrong:** `process.env.GEMINI_API_KEY` is `undefined` in `notesGenerator.ts` because the env file load in `worker/src/env-setup.ts` (imported at the top of `index.ts`) happens before other imports, but `GEMINI_API_KEY` may not be in `worker/.env.local`.
**Why it happens:** New env var added for Phase 5; developer forgets to add it to `worker/.env.local` and Railway.
**How to avoid:** Add a startup guard in `notesGenerator.ts` (or in `index.ts`) that logs a warning if `GEMINI_API_KEY` is absent but does NOT `process.exit(1)` — instead treat missing key as a soft-fail condition (no key → skip note generation, set `studyNotes = null`).
**Warning signs:** Notes always null even when Gemini call code looks correct; no error logged.

---

## Code Examples

### Gemini SDK — Text Generation

```typescript
// Source: [CITED: github.com/googleapis/js-genai README]
// Package: @google/genai v2.10.0
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Your prompt here',
})
console.log(response.text)  // string output
```

### react-markdown — Prose Rendering

```tsx
// Source: [CITED: github.com/remarkjs/react-markdown]
// Package: react-markdown v10.1.0
import Markdown from 'react-markdown'

// With Tailwind Typography prose class (Tailwind v4):
<div className="prose prose-neutral max-w-none">
  <Markdown>{studyNotes}</Markdown>
</div>
```

### @tailwindcss/typography — Tailwind v4 Registration

```css
/* Source: [CITED: github.com/tailwindlabs/tailwindcss-typography] */
/* In src/app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@plugin "@tailwindcss/typography";
```

### @react-pdf/renderer — Full Download Button Pattern

```tsx
// Source: [CITED: react-pdf.org/components]
// Status-view.tsx Notes tab — State B: notes available
'use client'
import dynamic from 'next/dynamic'
import { StudyNotesPDFDocument } from './StudyNotesPDFDocument'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false, loading: () => null }
)

// In Notes tab content (State B):
<PDFDownloadLink
  document={<StudyNotesPDFDocument topic={topic} studyNotes={studyNotes} youtubeUrl={youtubeUrl} />}
  fileName={`study-notes-${topic.toLowerCase().replace(/\s+/g, '-')}.pdf`}
>
  {({ loading }) => (
    <Button variant="default" size="sm" disabled={loading} className="w-fit font-semibold">
      <Download size={16} className="mr-2" />
      {loading ? 'Preparing PDF...' : 'Download PDF'}
    </Button>
  )}
</PDFDownloadLink>
```

### Prisma Schema — studyNotes Column

```prisma
// Source: [ASSUMED] — follows existing pattern in prisma/schema.prisma
// After existing videoExpiresAt field
studyNotes         String?   // Phase 5: AI-generated study notes Markdown text
```

### Prisma Migration — Expected SQL

```sql
-- Source: [ASSUMED] — follows pattern of 20260626000001_add_video_url_expires_at/migration.sql
-- AlterTable
ALTER TABLE "Job" ADD COLUMN "studyNotes" TEXT;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google/generative-ai` SDK | `@google/genai` SDK | 2025 (new SDK released) | Different import name, different API shape; older SDK frozen at v0.x |
| `gemini-1.5-flash` model ID | `gemini-2.5-flash` model ID | 2025-2026 | Prior models deprecated/shut down; new ID required |
| `tailwind.config.js` plugins array | `@plugin` directive in CSS | Tailwind v4 | Project already uses Tailwind v4; must use CSS approach |
| `@google/generative-ai` `GenerativeModel.generateContent()` | `@google/genai` `ai.models.generateContent()` | 2025 | Different client instantiation and method shape |

**Deprecated/outdated:**

- `@google/generative-ai`: No longer receiving Gemini 2.0+ features. Package still exists (v0.24.1) but is the legacy SDK. [CITED: github.com/googleapis/js-genai]
- `gemini-1.5-flash` / `gemini-2.0-flash`: Model IDs deprecated and marked shutdown per current Google documentation. [CITED: ai.google.dev/gemini-api/docs/models]
- `tailwind.config.js` `plugins: [require('@tailwindcss/typography')]`: v3 pattern — does not apply in Tailwind v4.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@google/genai` v2.10.0 with `gemini-2.5-flash` is available on the Gemini free tier (API key from Google AI Studio) | Standard Stack | If free tier does not cover `gemini-2.5-flash`, need to use `gemini-2.5-flash-lite` or another free-tier model |
| A2 | The Gemini free tier limits (previously documented as 1M tokens/day, 15 RPM for flash models) still apply in the same form | Standard Stack | If limits changed, the worker may hit rate limits under load; retry strategy may need adjustment |
| A3 | Stripping Markdown with the lightweight regex in Pattern 6 is sufficient for well-formed Gemini output | PDF Generation | If Gemini outputs unusual Markdown (tables, code blocks), the strip regex may leave artifacts; a more comprehensive strip or a `remark-stringify` approach may be needed |
| A4 | `notesSettled` initialized to `true` when `initialStatus === JobStatus.DONE` is the right initialization condition for the loading/soft-fail distinction | Frontend State | If a job can be served server-rendered as DONE before notes are generated (race), the settled=true initialization will show soft-fail immediately; initialization may need to check `initialStudyNotes !== undefined` |
| A5 | `dynamic(() => import('@react-pdf/renderer').then(m => m.PDFDownloadLink), { ssr: false })` resolves the Next.js 16 build issue for `PDFDownloadLink` | PDF Integration | If Next.js 16 has a different resolution for ESM imports of PDF libraries, may need `serverExternalPackages` config instead |
| A6 | Gemini's Markdown output will consistently use `##` headings and `-` bullet lists per the prompt instructions | PDF Strip Regex | If Gemini outputs other Markdown patterns (e.g., `###`, `*` bullets, HTML), the strip regex needs extending |

**Note on A1–A2:** The CONTEXT.md locked decision D-01 states "Free tier: 1M tokens/day, 15 RPM" for Google Gemini Flash — this was correct at the time of the discussion session. Research was unable to confirm current free tier limits from the Google AI rate-limits page (it directs to AI Studio UI for live values). These limits are [ASSUMED] to still apply.

---

## Open Questions (RESOLVED)

1. **SDK Package vs. CONTEXT.md Decision D-01** — RESOLVED (user-approved 2026-06-26)
   - What we know: CONTEXT.md D-01 specifies `@google/generative-ai`; research confirms this package is the legacy SDK, no longer receiving Gemini 2.0+ features. The new SDK is `@google/genai`.
   - **Resolution:** User approved switching to `@google/genai` with `gemini-3-flash` (the current Gemini Flash model). Spirit of D-01 preserved (Gemini Flash, free tier); package name and model ID updated. Plans use `@google/genai` throughout.

2. **`notesSettled` initialization for server-rendered DONE jobs** — RESOLVED
   - **Resolution:** Pass `initialStudyNotes` as a prop to `StatusView`. Initialize `notesSettled = initialStatus === JobStatus.DONE`. Implemented in Plan 02 Task 3.

3. **Prisma migration naming and timing** — RESOLVED
   - **Resolution:** Adding a nullable TEXT column to PostgreSQL is a safe online operation — no downtime required. Migration follows existing pattern `ALTER TABLE "Job" ADD COLUMN ...`. Implemented in Plan 01 Task 1.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Worker Gemini SDK | ✓ | 22.19.0 | — |
| `@google/genai` npm package | note generation | ✗ (not yet installed) | 2.10.0 (latest) | — (must install) |
| `react-markdown` npm package | Notes tab rendering | ✗ (not yet installed) | 10.1.0 (latest) | — (must install) |
| `@react-pdf/renderer` npm package | PDF download | ✗ (not yet installed) | 4.5.1 (latest) | — (must install) |
| `@tailwindcss/typography` npm package | prose styling | ✗ (not yet installed) | 0.5.20 (latest) | — (must install) |
| `GEMINI_API_KEY` env var | Worker note generation | ✗ (not set) | — | Soft-fail: notes = null when key absent |
| Prisma migration | `studyNotes` column | ✗ (not run) | — | Must run `prisma migrate dev` |
| Supabase database (live) | schema migration | ✓ (from prior phases) | — | — |

**Missing dependencies with no fallback (must be installed):**
- `@google/genai` (worker)
- `react-markdown` (frontend)
- `@react-pdf/renderer` (frontend)
- `@tailwindcss/typography` (frontend)
- Prisma migration must run

**Missing dependencies with fallback:**
- `GEMINI_API_KEY`: If absent, worker soft-fails note generation (studyNotes = null) — video and transcript still work

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4.1.8 (frontend) + Vitest v4.1.8 (worker) |
| Config file | `vitest.config.mts` (frontend, jsdom env) / `worker/vitest.config.ts` (worker, node env) |
| Quick run command | `npm run test:run` (from root for frontend; from worker/ for worker) |
| Full suite command | `npm run test:run && cd worker && npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOT-01 | `generateStudyNotes()` returns non-null string from transcript entries | unit | `cd worker && npm run test:run -- src/__tests__/notesGenerator.test.ts` | ❌ Wave 0 |
| NOT-01 | `generateStudyNotes()` returns null on Gemini API failure (soft-fail) | unit | same | ❌ Wave 0 |
| NOT-01 | `generateStudyNotes()` retries once before returning null | unit | same | ❌ Wave 0 |
| NOT-02/03/04 | Gemini prompt includes topic name and transcript text | unit (mock) | same | ❌ Wave 0 |
| NOT-05 | Notes tab shows `PDFDownloadLink` "Download PDF" button when `studyNotes` is available | unit (RTL) | `npm run test:run -- src/__tests__/status-view-notes-tab.test.tsx` | ❌ Wave 0 |
| NOT-05 | Notes tab shows "Generating your study notes..." when DONE but notes not yet settled | unit (RTL) | same | ❌ Wave 0 |
| NOT-05 | Notes tab shows soft-fail message when notesSettled && studyNotes === null | unit (RTL) | same | ❌ Wave 0 |
| NOT-05 | Existing tests continue to pass (no regression from status-view.tsx changes) | regression | `npm run test:run` | ✅ |

### Sampling Rate

- **Per task commit:** `npm run test:run` (root) and `cd worker && npm run test:run`
- **Per wave merge:** Both test suites must pass fully
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `worker/src/__tests__/notesGenerator.test.ts` — covers NOT-01 (generateStudyNotes happy path, soft-fail, retry)
- [ ] `src/__tests__/status-view-notes-tab.test.tsx` — covers NOT-05 (Notes tab three-state rendering: loading, notes available, soft-fail)
- [ ] `@react-pdf/renderer` must be mocked in the RTL test environment (jsdom does not support PDF canvas APIs)

**Note on mocking `@react-pdf/renderer` in RTL tests:** The `PDFDownloadLink` uses browser APIs not available in jsdom. Tests for the Notes tab must mock `@react-pdf/renderer`:

```typescript
// In src/__tests__/status-view-notes-tab.test.tsx
vi.mock('next/dynamic', () => ({
  default: (fn: () => Promise<{ default: unknown }>) => {
    // Return a simple stub Button so tests can assert "Download PDF" text
    return function MockPDFDownloadLink({ children }: { children: (s: { loading: boolean }) => React.ReactNode }) {
      return <>{children({ loading: false })}</>
    }
  },
}))
// Or mock @react-pdf/renderer directly:
vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }: any) => <>{children({ loading: false })}</>,
  Document: ({ children }: any) => <>{children}</>,
  Page: ({ children }: any) => <>{children}</>,
  View: ({ children }: any) => <>{children}</>,
  Text: ({ children }: any) => <>{children}</>,
  StyleSheet: { create: (s: any) => s },
}))
```

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase uses anonymous sessions established in Phase 1 — no new auth |
| V3 Session Management | no | No new session state introduced |
| V4 Access Control | yes | Gemini API key is worker-only (never in NEXT_PUBLIC_ vars); `GEMINI_API_KEY` in `worker/.env.local` only |
| V5 Input Validation | yes | Transcript text passed to Gemini prompt is sourced from YouTube transcript (not user-typed input); topic from `job.topic` which was validated at submission time in Phase 1 |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Gemini API key exposure | Information Disclosure | Worker-only env var — never in NEXT_PUBLIC_ or client code; matches existing `SUPABASE_SERVICE_ROLE_KEY` pattern |
| Prompt injection via `job.topic` | Tampering | Topic field validated as non-empty string at submission (Phase 1 Zod schema); passed as interpolated string into prompt (not code execution) |
| XSS via rendered Markdown | XSS | `react-markdown` is safe-by-default (no `dangerouslySetInnerHTML`); renders semantic HTML elements only |
| XSS via PDF content | XSS | PDF is a local download — not rendered in the DOM; no XSS vector |
| Over-large Gemini response in DB | DoS/storage | `studyNotes Text?` has no hard size limit in Postgres; Gemini output for a stitched transcript is expected to be modest (< 10KB); no mitigation needed for MVP |

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md content: `@AGENTS.md` → which contains:

> **This is NOT the Next.js you know.** This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Actionable directive:** Before writing any Next.js code in this phase (particularly for `dynamic()` import and the `status-view.tsx` modifications), verify the current API in `node_modules/next/dist/docs/01-app/`. The `use client` directive and `next/dynamic` API were confirmed as stable in the installed Next.js 16.2.9 docs.

**Verified in `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`:** `'use client'` directive behavior is unchanged from training data. [CITED: local docs]

---

## Sources

### Primary (MEDIUM confidence)

- [CITED: github.com/googleapis/js-genai] — `@google/genai` SDK README; text generation example, `GoogleGenAI` class, `gemini-2.5-flash` model name, `response.text` accessor
- [CITED: github.com/remarkjs/react-markdown] — react-markdown v10 README; installation, basic usage, safe-by-default behavior
- [CITED: react-pdf.org/components] — `@react-pdf/renderer` components API; `PDFDownloadLink`, `Document`, `Page`, `View`, `Text`, web-only label
- [CITED: react-pdf.org/compatibility] — Next.js SSR crash bug (fixed since 14.1.1), React 19 support since v4.1.0
- [CITED: github.com/tailwindlabs/tailwindcss-typography] — Tailwind v4 `@plugin` directive installation; `prose prose-neutral max-w-none` usage
- [CITED: ai.google.dev/gemini-api/docs/models] — `gemini-2.5-flash` as current stable flash model; `gemini-1.5-flash` and `gemini-2.0-flash` deprecated/shut down
- [CITED: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md] — `'use client'` directive confirmed stable

### Secondary (LOW confidence)

- [CITED: github.com/diegomura/react-pdf/issues/2754] — `PDFDownloadLink` in Next.js requires `dynamic(ssr: false)`; confirmed by community issue and multiple sources
- [CITED: ai.google.dev/gemini-api/docs/quickstart] — `@google/genai` package name, installation, API key env var auto-detection
- npm registry `npm view` results — confirmed package versions and existence: `@google/genai@2.10.0`, `react-markdown@10.1.0`, `@react-pdf/renderer@4.5.1`, `@tailwindcss/typography@0.5.20`

### Tertiary (LOW confidence / training knowledge)

- Soft-fail and retry patterns for worker pipelines — [ASSUMED] standard Node.js pattern
- Prisma `Text?` column migration SQL pattern — [ASSUMED] based on observed migration files in project

---

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM — package versions verified via `npm view`; SDK change from `@google/generative-ai` to `@google/genai` [CITED: official Google repo]; model deprecations [CITED: Google docs]
- Architecture: HIGH — based on existing codebase patterns (Phase 3/4 worker modules, Realtime delivery, status-view.tsx state management)
- Pitfalls: MEDIUM — PDFDownloadLink SSR issue confirmed via multiple sources; Tailwind v4 plugin pattern confirmed via official docs; SDK rename confirmed

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 (30 days — stable libraries with slow-moving APIs)

**Key deviation from CONTEXT.md to flag for planner:**
- D-01 specifies `@google/generative-ai` SDK and `gemini-1.5-flash`/`gemini-2.0-flash` model names. Research confirms both are deprecated. Recommendation: use `@google/genai` with `gemini-2.5-flash`. The spirit of D-01 (free-tier Gemini Flash) is preserved.
