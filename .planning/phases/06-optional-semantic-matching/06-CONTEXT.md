# Phase 6: Optional Semantic Matching - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 adds an optional semantic matching mode alongside the existing exact-match pipeline. Users opt in via a toggle on the submission form before submitting. When enabled, the worker embeds the topic and each transcript segment using Gemini's text-embedding-004 model, computes cosine similarity, and promotes segments above a threshold to the clip plan as semantic matches. Semantic matches are stored separately from exact matches in `clipPlan` (MAT-03) and include a confidence indicator (MAT-04). The existing exact-match path is unchanged — semantic matching only runs when the user enables it. Schema migration, worker embedding module, submission form toggle, and match labeling are all in scope. Any UI for browsing or filtering by match type beyond basic labeling is out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Semantic Engine
- **D-01:** Embedding model — **Gemini text-embedding-004** (free tier: 1500 RPM). Uses the `@google/generative-ai` SDK already installed in the worker from Phase 5. Reuses the existing `GEMINI_API_KEY` env var — no new credentials required.
- **D-02:** Chunking unit — **individual transcript segments**. Each `TranscriptSegment` is embedded as-is. Segments are already timestamped units, so similarity scores map cleanly back to `startMs`/`endMs` without boundary reconciliation.
- **D-03:** Threshold and cap — **fixed: cosine similarity ≥ threshold (Claude's discretion, approximately 0.75), max 10 semantic matches**. Bounds video length and prevents low-relevance segments from inflating output. Exact threshold at Claude's discretion based on text-embedding-004 score distributions.
- **D-04:** API key — **reuse `GEMINI_API_KEY`**. Same env var and SDK already configured in `worker/.env.local` and Railway. No new environment variables.

### Match Storage
- **D-05:** `ClipMatch` type extension — Add `matchType: 'exact' | 'semantic'` and `confidence?: number` (cosine similarity score, 0–1) to the existing `ClipMatch` interface in `worker/src/types.ts`. This satisfies MAT-03 (kept separate) and MAT-04 (confidence indicator). Exact matches carry `matchType: 'exact'`; existing exact-match code sets this.
- **D-06:** `clipPlan` column — The existing `clipPlan Json?` column on Job stores the full array of `ClipMatch` objects. Phase 6 adds `matchType` and `confidence` fields to those objects in place — no new column needed. Schema migration: none beyond the schema types change.

### Submission Toggle
- **D-07:** `semanticEnabled Boolean @default(false)` column added to the Prisma `Job` model. Requires a Prisma migration. The submission Server Action reads the checkbox value and writes it to the Job row. Worker reads `job.semanticEnabled` to decide whether to run the embedding path.

### Claude's Discretion
- Exact cosine similarity threshold value (approximately 0.75 — calibrate to text-embedding-004 score range)
- Exact semantic match cap (approximately 5–10 — keep bounded)
- Semantic toggle placement and label on the submission form (checkbox below the topic field; label aimed at students, e.g., "Also find related references" — not "Enable semantic matching")
- Whether the Transcript tab labels semantic-matched segments with a visual indicator (badge, icon) or keeps it backend-only
- MAT-04 confidence display format (numeric score vs qualitative label like "Related" vs no visible indicator in v1 UI)
- Worker semantic module file name (e.g., `worker/src/semanticMatcher.ts`)
- Batch size for embedding API calls (to stay within rate limits)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Core constraints: free tiers only, low-cost operation, YouTube-first, anonymous v1
- `.planning/REQUIREMENTS.md` — Phase 6 covers SUB-04, MAT-02, MAT-03, MAT-04
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, and 2-plan breakdown

### Prior Phase Context
- `.planning/phases/04-stitched-video-output/04-CONTEXT.md` — D-01 (free tiers only — Gemini Flash free tier; embeddings must stay on free tier too)
- `.planning/phases/05-study-notes-and-pdf/05-CONTEXT.md` — D-01 (Gemini Flash + `@google/generative-ai` SDK setup), D-03 (`GEMINI_API_KEY` in worker/.env.local and Railway)

### Existing Code
- `worker/src/matcher.ts` — `findMatches()` / `buildClipPlan()`: exact-match pipeline; Phase 6 runs alongside this, not replacing it
- `worker/src/types.ts` — `ClipMatch` and `TranscriptSegment` interfaces; Phase 6 extends `ClipMatch` with `matchType` and `confidence`
- `worker/src/index.ts` — `buildClipPlan()` call at line 88; Phase 6 adds semantic path here, guarded by `job.semanticEnabled`
- `worker/src/notesGenerator.ts` — Pattern for `@google/generative-ai` SDK usage in the worker; follow the same import/init pattern
- `src/components/submission-form.tsx` — Two-field form; Phase 6 adds a checkbox after the topic field
- `src/actions/submit-job.ts` — Server Action; parse and validate `semanticEnabled` checkbox value (Zod schema update)
- `prisma/schema.prisma` — Add `semanticEnabled Boolean @default(false)` to Job model; requires Prisma migration
- `src/types/job.ts` — `Job` interface; add `semanticEnabled: boolean`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worker/src/notesGenerator.ts` — Import pattern for `@google/generative-ai`; embed call will use the same `genAI.getGenerativeModel()` pattern but with `text-embedding-004` instead of Flash
- `worker/src/matcher.ts:27` — `findMatches()` returns `ClipMatch[]`; semantic matcher returns the same shape with `matchType: 'semantic'` added
- `src/components/submission-form.tsx:86–112` — Two-field pattern (URL + topic); checkbox goes here with the same Label/Input pattern from shadcn
- `src/actions/submit-job.ts` — Zod schema already validates `youtubeUrl` and `topic`; add `semanticEnabled: z.coerce.boolean().default(false)` to the same schema

### Established Patterns
- Worker module pattern: separate file, single exported function — follow for `worker/src/semanticMatcher.ts`
- `ClipMatch` interface in `worker/src/types.ts` mirrors `src/types/job.ts` — update both when adding `matchType`/`confidence`
- `job.semanticEnabled` read from Job row in `processPendingJob()` at `worker/src/index.ts` — same pattern as `job.topic`, `job.youtubeUrl`
- Prisma migration pattern: add nullable/defaulted column, run `prisma migrate dev` — same as `studyNotes` in Phase 5

### Integration Points
- `worker/src/index.ts:88` — After `buildClipPlan(segments, job.topic)`, conditionally call `findSemanticMatches(segments, job.topic)` when `job.semanticEnabled`. Merge results, deduplicating any segments also found by exact match.
- `src/components/submission-form.tsx` — Add `<Checkbox>` (shadcn) and `<Label>` below the topic field; name attribute `semanticEnabled`
- `src/actions/submit-job.ts` — Read `formData.get('semanticEnabled')` and pass to `prisma.job.create()`

</code_context>

<specifics>
## Specific Ideas

- **Free tier confirmed** — text-embedding-004 is free at 1500 RPM. Combined with notes generation (Gemini Flash), both use the same `GEMINI_API_KEY` and stay within free-tier limits for v1 usage volumes.
- **No new credentials** — Reusing `GEMINI_API_KEY` keeps Railway config unchanged from Phase 5.
- **Individual segment embedding** — Keeps the semantic path simple and timestamp-accurate; avoids window-boundary math.
- **Fixed threshold + cap** — Bounds output deterministically; avoids runaway video length when a topic is broadly mentioned.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-optional-semantic-matching*
*Context gathered: 2026-06-27*
