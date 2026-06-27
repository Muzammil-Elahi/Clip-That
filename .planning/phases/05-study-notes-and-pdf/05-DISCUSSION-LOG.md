# Phase 5: Study Notes and PDF - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 05-study-notes-and-pdf
**Areas discussed:** AI provider for note generation, Notes format and storage, PDF generation approach, AI failure handling

---

## AI Provider for Note Generation

| Option | Description | Selected |
|--------|-------------|----------|
| Google Gemini Flash | Free tier: 1M tokens/day, 15 RPM. `@google/generative-ai` Node SDK. | ✓ |
| Anthropic Claude API | Pay-as-you-go. claude-haiku-4-5 cheapest (~$0.80/M input tokens). | |
| OpenAI | Pay-as-you-go (no free tier since 2024). gpt-4o-mini cheapest. | |

**User's choice:** Initially selected Anthropic ("using Claude Code so stick with Anthropic"), then changed to Google Gemini ("change to Google Gemini since it's free").

**Notes:** Free tier constraint from Phase 4 (D-01) applies. User noted PDF skill availability but it was determined to be Python-based and not directly applicable to the Next.js/TypeScript stack.

| Sub-question: Model | Options | Selected |
|---------------------|---------|----------|
| claude-haiku-4-5 | Cheapest Claude 4.x model | initially picked |
| → (changed to Gemini) | — | — |

| Sub-question: Output format | Options | Selected |
|-----------------------------|---------|----------|
| Freeform Markdown | Well-formatted sections, simple rendering | ✓ |
| Structured JSON | Strict schema with keyPoints[], definitions[] | |

| Sub-question: API key location | Options | Selected |
|-------------------------------|---------|----------|
| worker/.env.local (same as WORKER_DATABASE_URL) | Follows existing pattern | ✓ |

---

## Notes Format and Storage

| Option | Description | Selected |
|--------|-------------|----------|
| studyNotes Text? column | Plain Markdown string. Simple migration. | ✓ |
| studyNotes Json? column | Consistent with transcript/clipPlan/stitchedTranscript pattern but redundant for plain Markdown. | |

**User's choice:** `studyNotes Text?` column.

| Sub-question: Markdown rendering | Options | Selected |
|-----------------------------------|---------|----------|
| react-markdown with prose class | Lightweight, widely used, Tailwind Typography integration | ✓ |
| Custom renderer | No deps but fragile | |
| Pre-formatted text (whitespace-pre) | Zero deps but crude (shows ## and **) | |

| Sub-question: Delivery mechanism | Options | Selected |
|----------------------------------|---------|----------|
| Supabase Realtime (same pattern as Phase 3–4) | Zero new infrastructure | ✓ |
| Separate fetch on DONE event | Extra round-trip | |

---

## PDF Generation Approach

| Option | Description | Selected |
|--------|-------------|----------|
| window.print() with print CSS | Zero dependencies, browser-native | |
| @react-pdf/renderer | React-based PDF, client-side PDFDownloadLink, ~200KB bundle | ✓ |
| jsPDF + html2canvas | Rasterized image PDF, ~400KB bundle | |

**User's choice:** `@react-pdf/renderer`.

| Sub-question: Client vs server | Options | Selected |
|-------------------------------|---------|----------|
| Client-side only (PDFDownloadLink) | No new API routes | ✓ |
| Server-side API route | Adds route + server bundle | |

| Sub-question: PDF content | Options | Selected |
|--------------------------|---------|----------|
| Topic header + notes + video URL | Study-focused, includes source attribution | ✓ |
| Notes content only | No title or attribution | |

---

## AI Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Soft fail — Job stays DONE, Notes tab shows error | Preserves video and transcript access | ✓ |
| Hard fail — Job → FAILED | Forces full retry, loses video/transcript | |

**User's choice:** Soft fail.

| Sub-question: Retry policy | Options | Selected |
|---------------------------|---------|----------|
| 1 retry with exponential backoff | Handles transient errors | ✓ |
| No retry | Simpler, more frequent soft-fails | |

| Sub-question: Notes tab loading state | Options | Selected |
|---------------------------------------|---------|----------|
| Loading state in Notes tab when studyNotes is null post-DONE | User preference | ✓ |
| Nothing — Notes tab only shown after DONE with notes | No loading state | |

---

## Claude's Discretion

- Exact Gemini model name (`gemini-1.5-flash` vs `gemini-2.0-flash`)
- Gemini prompt wording, note structure order, and study-tone guidance
- Notes tab loading UX (spinner, skeleton, or "Generating notes..." text)
- `@react-pdf/renderer` PDF component layout, fonts, and styling
- Worker note-generation module file name (`worker/src/notesGenerator.ts`)
- Prisma field name (prefer `studyNotes`)

## Deferred Ideas

None — discussion stayed within phase scope.
