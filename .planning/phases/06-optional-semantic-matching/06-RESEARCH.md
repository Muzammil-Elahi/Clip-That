# Phase 06: Optional Semantic Matching - Research

**Researched:** 2026-06-27
**Domain:** Gemini Embeddings API, cosine similarity retrieval, Prisma schema migration, Next.js form Server Actions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Semantic Engine:**
- D-01: Embedding model — Gemini text-embedding-004 referenced in CONTEXT.md, but shut down Jan 14 2026. The correct replacement is `gemini-embedding-001`. Reuses the existing `GEMINI_API_KEY` env var. No new credentials.
- D-02: Chunking unit — individual transcript segments. Each `TranscriptSegment` embedded as-is; timestamps map cleanly to `startMs`/`endMs`.
- D-03: Threshold and cap — fixed: cosine similarity >= 0.75 (approximately), max 10 semantic matches. Both exposed as named constants (Claude's discretion on exact values).
- D-04: API key — reuse `GEMINI_API_KEY`. Same env var already configured in `worker/.env.local` and Railway.

**Match Storage:**
- D-05: `ClipMatch` type extension — Add `matchType: 'exact' | 'semantic'` and `confidence?: number` (cosine similarity 0-1) to `ClipMatch` interface in both `worker/src/types.ts` and `src/types/job.ts`. Optional fields so exact-match code needs no change.
- D-06: `clipPlan Json?` column unchanged — Phase 6 adds `matchType` and `confidence` fields to `ClipMatch` objects in-place. No new JSON column needed.

**Submission Toggle:**
- D-07: `semanticEnabled Boolean @default(false)` column added to Prisma `Job` model. Requires a Prisma migration (`prisma migrate dev`). Submission Server Action reads the checkbox value and writes it. Worker reads `job.semanticEnabled` to decide whether to run the embedding path.

### Claude's Discretion
- Exact cosine similarity threshold value (approximately 0.75 — calibrate to gemini-embedding-001 score range)
- Exact semantic match cap (approximately 5-10 — keep bounded; AI-SPEC says 10)
- Semantic toggle placement and label on the submission form (checkbox below the topic field; student-friendly label e.g. "Also find related references")
- Whether Transcript tab labels semantic-matched segments with a visual indicator
- MAT-04 confidence display format (numeric score vs. qualitative label vs. no visible UI indicator in v1)
- Worker semantic module file name (`worker/src/semanticMatcher.ts` as specified in AI-SPEC)
- Batch size for embedding API calls (AI-SPEC recommends chunk size of 20 strings per call)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-04 | User can optionally enable semantic reference matching before processing. | Submission form checkbox with `semanticEnabled` name; Zod schema `z.coerce.boolean().optional().default(false)`; Prisma `semanticEnabled Boolean @default(false)` |
| MAT-02 | System can find semantically related transcript segments when semantic matching is enabled. | `findSemanticMatches()` in `semanticMatcher.ts` using `gemini-embedding-001` + cosine similarity >= `SEMANTIC_THRESHOLD` |
| MAT-03 | System keeps exact matches separate from semantic matches in the clip plan. | `matchType: 'exact' | 'semantic'` field on `ClipMatch`; dedup logic removes only semantic matches whose `segmentIndices` overlap exact matches — never removes exact matches themselves |
| MAT-04 | System can include a reason or confidence indicator for semantic matches. | `confidence?: number` field on `ClipMatch` (cosine similarity 0-1, 2 decimal places); UI treatment at Claude's discretion |

</phase_requirements>

---

## Summary

Phase 6 adds an optional semantic retrieval path alongside the existing exact-match pipeline. When a user opts in via a checkbox before submission, the worker embeds the study topic and every transcript segment using Google's `gemini-embedding-001` model, computes cosine similarity, and promotes segments above a calibrated threshold into the clip plan alongside exact matches.

The implementation is a single new module (`worker/src/semanticMatcher.ts`) that follows the established patterns from `notesGenerator.ts`. It exports one async function `findSemanticMatches(segments, topic)` returning `ClipMatch[]` with `matchType: 'semantic'` and a numeric confidence score. The integration point in `worker/src/index.ts` is after line 88 (`buildClipPlan()` call), wrapped in a try/catch soft-fail guard. Semantic failures must never fail the job.

The frontend change is a single checkbox field added to `submission-form.tsx` below the topic input. The Server Action schema (`src/lib/schemas.ts`) gains `semanticEnabled: z.coerce.boolean().optional().default(false)`. The Prisma `Job` model gains `semanticEnabled Boolean @default(false)`, requiring one migration. Both `ClipMatch` interfaces (worker and frontend) gain optional `matchType` and `confidence` fields — optional so all existing exact-match code requires zero changes.

**Primary recommendation:** Follow the AI-SPEC skeleton verbatim. All critical design decisions are pre-made and validated. Use `gemini-embedding-001` (NOT `text-embedding-004` — shut down Jan 14 2026). Sequential batch embedding chunks of 20 strings per `embedContent()` call. Soft-fail at every API boundary.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Semantic toggle UI | Browser/Client | Frontend Server (SSR) | Checkbox rendered in client component `submission-form.tsx`; Server Action processes the form value |
| Toggle validation and persistence | API/Backend (Server Action) | Database | Zod schema in `submit-job.ts` validates; Prisma writes `semanticEnabled` to Job row |
| Embedding computation | Background Worker | — | `findSemanticMatches()` in worker process; Gemini API call from worker, not from Next.js API routes |
| Cosine similarity scoring | Background Worker | — | Pure math in worker; no external service call after embeddings are obtained |
| Match type labeling | Background Worker | — | `matchType: 'semantic'` set on `ClipMatch` objects in `findSemanticMatches()` before storing to DB |
| Confidence display (optional) | Browser/Client | — | Frontend reads `clipPlan` from Job row; display treatment is a UI-only decision |

---

## Standard Stack

### Core (all already installed — no new packages for Phase 6 worker)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | 2.10.0 | Gemini Embeddings API (`ai.models.embedContent()`) | Official Google SDK, already in `worker/package.json`; same package used for Phase 5 notes |
| `vitest` | 4.1.8 (installed), 4.1.9 (registry) | Test suite for `semanticMatcher.ts` unit tests | Already installed and configured in `worker/vitest.config.ts` |
| `zod` | 4.4.3 | Schema validation for `semanticEnabled` checkbox field | Already used in `src/lib/schemas.ts`; `z.coerce.boolean()` handles checkbox FormData correctly |
| `prisma` | 7.8.0 | Schema migration for `semanticEnabled Boolean @default(false)` | Already used; same migration pattern as Phase 5 `studyNotes` column |

**No new packages to install for this phase.** `@google/genai` is already in `worker/package.json`. Shadcn checkbox component must be added via CLI if not available.

### Supporting (frontend — may need shadcn Checkbox)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `Checkbox` component | via CLI | Accessible checkbox for semantic toggle | Need to run `npx shadcn@latest add checkbox` if not already installed |

**Checkbox availability check:** The `src/components/ui/` directory currently contains: `button.tsx`, `input.tsx`, `label.tsx`, `progress.tsx`, `card.tsx`, `alert.tsx`, `tabs.tsx`. There is NO `checkbox.tsx`. A shadcn Checkbox component must be added. [VERIFIED: filesystem grep]

**Installation:**
```bash
# Worker — no new packages needed
# Frontend — add shadcn checkbox component
npx shadcn@latest add checkbox
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `gemini-embedding-001` direct SDK | vector DB (Pinecone, Weaviate) | No persistence needed per-job; stateless cosine math is sufficient at Phase 6 scope |
| Sequential chunk embedding | `Promise.all()` concurrent | Concurrent bursts hit 429 on free tier at 500+ segments; sequential is slower but rate-safe |
| shadcn Checkbox | native `<input type="checkbox">` | shadcn Checkbox follows established UI pattern; native also valid but inconsistent with component library |

---

## Package Legitimacy Audit

> All packages in this phase are either already installed in the project or are shadcn components (CLI-generated local code, not npm dependencies).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@google/genai` | npm | Created 2025-03-11 | 17.2M/wk | github.com/googleapis/js-genai | SUS (too-new flag) | **Approved — already in project** (installed Phase 5; Google official SDK; 17M weekly downloads; verdict is tool artifact from recent version release, not package legitimacy issue) |
| `vitest` | npm | Created 2021-12-03 | 70M/wk | github.com/vitest-dev/vitest | SUS (too-new flag) | **Approved — already in project** (installed Phase 1; 70M weekly downloads; verdict is tool artifact from recent version release) |
| `zod` | npm | Created 2020-03-07 | 211M/wk | github.com/colinhacks/zod | OK | Approved |

**Packages removed due to SLOP verdict:** none

**Packages flagged as suspicious SUS:** `@google/genai` and `vitest` were flagged by the legitimacy tool as "too-new" due to recent version releases (June 2026), but both are well-established packages with multi-year histories and tens of millions of weekly downloads. Both are **already installed** in the project from prior phases. The SUS flag is a tool artifact — not a legitimacy concern. [VERIFIED: npm registry — creation dates confirmed 2025-03-11 and 2021-12-03 respectively]

---

## Architecture Patterns

### System Architecture Diagram

```
User submits form (checkbox: semanticEnabled=true/false)
        |
        v
Server Action (submit-job.ts)
  - Zod validates: z.coerce.boolean().optional().default(false)
  - prisma.job.create({ semanticEnabled: true|false })
        |
        v
Worker polls PENDING job
  - reads job.semanticEnabled from DB
        |
    [always]
        v
buildClipPlan(segments, topic)  --> exactMatches: ClipMatch[]
        |
    [if job.semanticEnabled === true]
        v
findSemanticMatches(segments, topic)  [soft-fail wrapper]
  - batchEmbed([topic])  --> topicVec: number[768]
  - batchEmbed(segTexts, chunkSize=20)  --> segVecs: number[][]
  - cosineSimilarity(topicVec, segVec[i]) per segment
  - filter >= SEMANTIC_THRESHOLD, sort desc, slice MAX_SEMANTIC_MATCHES
  --> semanticMatches: ClipMatch[] (matchType:'semantic', confidence:0.xx)
        |
        v
Deduplication
  - exactIndices = Set(exactMatches.flatMap(m => m.segmentIndices))
  - dedupedSemantic = semanticMatches.filter(no index overlap with exactIndices)
        |
        v
clipPlan = [...exactMatches, ...dedupedSemantic]
  - stored in Job.clipPlan (Json?)
        |
        v
(downstream: expandContextWindows, mergeOverlappingWindows, video pipeline unchanged)
```

### Recommended Project Structure

```
worker/src/
├── semanticMatcher.ts    # NEW — embedding + cosine similarity (Phase 6)
├── matcher.ts            # UNCHANGED — exact-match pipeline
├── notesGenerator.ts     # PATTERN SOURCE — follow import/init/retry pattern
├── index.ts              # MODIFIED — add semantic path after line 88
├── types.ts              # MODIFIED — add matchType? and confidence? to ClipMatch

src/
├── lib/schemas.ts        # MODIFIED — add semanticEnabled field
├── types/job.ts          # MODIFIED — add matchType? and confidence? to ClipMatch, semanticEnabled to Job
├── components/
│   ├── submission-form.tsx    # MODIFIED — add Checkbox + Label after topic field
│   └── ui/checkbox.tsx        # NEW — shadcn Checkbox component (npx shadcn add checkbox)
├── actions/submit-job.ts      # MODIFIED — pass semanticEnabled to prisma.job.create()

prisma/
├── schema.prisma         # MODIFIED — add semanticEnabled Boolean @default(false)
└── migrations/
    └── YYYYMMDDHHMMSS_add_semantic_enabled/  # NEW migration
```

### Pattern 1: Embedding and Cosine Similarity (semanticMatcher.ts)

**What:** Single exported async function using `@google/genai` v2 `ai.models.embedContent()` with sequential chunk batching.
**When to use:** When `job.semanticEnabled === true` in the worker job loop.

```typescript
// Source: AI-SPEC Section 3 + 4 (worker/src/semanticMatcher.ts skeleton)
import { GoogleGenAI } from '@google/genai'
import type { TranscriptSegment, ClipMatch } from './types.js'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })

const EMBEDDING_MODEL     = 'gemini-embedding-001'  // text-embedding-004 shut down Jan 14 2026
const SEMANTIC_THRESHOLD  = 0.75
const MAX_SEMANTIC_MATCHES = 10
const EMBED_CHUNK_SIZE    = 20  // strings per embedContent() call — stays inside 1500 RPM

async function batchEmbed(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += EMBED_CHUNK_SIZE) {
    const chunk = texts.slice(i, i + EMBED_CHUNK_SIZE)
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: chunk,                               // string[] — one embedding per element
      config: { taskType: 'SEMANTIC_SIMILARITY' },  // symmetric space for direct comparison
    })
    const embeddings = response.embeddings ?? []
    results.push(...embeddings.map(e => e.values ?? []))
  }
  return results
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return magA === 0 || magB === 0 ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export async function findSemanticMatches(
  segments: TranscriptSegment[],
  topic: string,
): Promise<ClipMatch[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('  GEMINI_API_KEY not set — skipping semantic matching (soft-fail)')
    return []
  }
  const topicVec = (await batchEmbed([topic]))[0]
  const segVecs  = await batchEmbed(segments.map(s => s.text))
  return segments
    .map((seg, i) => ({ seg, idx: i, score: cosineSimilarity(topicVec, segVecs[i]) }))
    .filter(s => s.score >= SEMANTIC_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SEMANTIC_MATCHES)
    .map(({ seg, idx, score }) => ({
      startMs:        Math.round(seg.offset * 1000),
      endMs:          Math.round((seg.offset + seg.duration) * 1000),
      text:           seg.text,
      segmentIndices: [idx],
      matchType:      'semantic' as const,
      confidence:     Math.round(score * 100) / 100,
    }))
}
```

### Pattern 2: Integration in worker/src/index.ts

**What:** Guard and merge pattern after `buildClipPlan()` at line 88.
**When to use:** Replace the bare `const clipPlan = buildClipPlan(...)` line.

```typescript
// Source: AI-SPEC Section 4 integration pattern
const exactMatches = buildClipPlan(segments, job.topic)

let semanticMatches: ClipMatch[] = []
if (job.semanticEnabled) {
  try {
    semanticMatches = await findSemanticMatches(segments, job.topic)
  } catch (err) {
    console.error('Semantic matching failed (soft-fail, exact matches preserved):', err)
  }
}

const exactIndices = new Set(exactMatches.flatMap(m => m.segmentIndices))
const dedupedSemantic = semanticMatches.filter(
  m => !m.segmentIndices.some(i => exactIndices.has(i)),
)
const clipPlan = [...exactMatches, ...dedupedSemantic]
```

### Pattern 3: ClipMatch Type Extension

**What:** Add optional fields to both ClipMatch interfaces (worker and frontend).
**When to use:** Wave 1 — before implementing semanticMatcher.ts so the type is available.

```typescript
// Source: AI-SPEC Section 4b — add to worker/src/types.ts AND src/types/job.ts
export interface ClipMatch {
  startMs: number
  endMs: number
  text: string
  segmentIndices: number[]
  // Phase 6 additions — optional so exact-match code requires zero changes
  matchType?:  'exact' | 'semantic'
  confidence?: number  // cosine similarity 0-1, 2 decimal places
}
```

### Pattern 4: Zod Schema for Checkbox FormData

**What:** Extend `submitJobSchema` in `src/lib/schemas.ts` with `semanticEnabled`.
**When to use:** Wave 1, alongside Server Action and Prisma changes.

```typescript
// Source: verified against Zod 4.4.3 installed in project
// z.coerce.boolean() correctly converts:
//   'on'       -> true  (HTML checkbox checked value)
//   null       -> false (FormData.get() returns null for unchecked/absent)
//   undefined  -> false (field absent from formData)
export const submitJobSchema = z.object({
  youtubeUrl: z.string().url(/* existing */).refine(/* existing */),
  topic:      z.string().min(2, /* existing */).max(200, /* existing */),
  semanticEnabled: z.coerce.boolean().optional().default(false),
})
```

Verified behavior (confirmed via installed Zod 4.4.3):
- `{ semanticEnabled: 'on' }` -> `{ semanticEnabled: true }` [VERIFIED: local test]
- `{ semanticEnabled: null }` -> `{ semanticEnabled: false }` [VERIFIED: local test]
- `{}` (field absent) -> `{ semanticEnabled: false }` [VERIFIED: local test]

### Pattern 5: Retry Wrapper (follow notesGenerator.ts)

**What:** One retry on 429/503 transient errors; throw immediately on structural errors.
**When to use:** Wrap `batchEmbed()` calls inside `findSemanticMatches()`.

```typescript
// Source: notesGenerator.ts retry pattern (already in codebase)
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

async function embedWithRetry(texts: string[]): Promise<number[][]> {
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      return await batchEmbed(texts)
    } catch (err: unknown) {
      const is429 = err instanceof Error && err.message.includes('429')
      if (attempt === 0 && is429) {
        console.warn('  Gemini embed 429 — retrying in 2s...')
        await sleep(2000)
      } else {
        throw err
      }
    }
  }
  throw new Error('unreachable')
}
```

### Pattern 6: Prisma Schema Addition

**What:** Add `semanticEnabled Boolean @default(false)` to Job model.
**When to use:** Wave 1 task 1 — migrate before worker code changes.

```prisma
// prisma/schema.prisma — add after studyNotes field
studyNotes     String?   // Phase 5
semanticEnabled Boolean @default(false)  // Phase 6
```

Migration command (same as every prior phase):
```bash
npx prisma migrate dev --name add_semantic_enabled
```

### Pattern 7: Shadcn Checkbox in submission-form.tsx

**What:** Add accessible Checkbox + Label below the topic field.
**When to use:** Wave 2 (frontend plan).

```typescript
// After topic field div, before Submit button div
// First: npx shadcn@latest add checkbox  (adds src/components/ui/checkbox.tsx)
import { Checkbox } from '@/components/ui/checkbox'

<div className="flex items-center gap-3">
  <Checkbox
    id="semanticEnabled"
    name="semanticEnabled"
    value="on"
    disabled={isPending}
  />
  <Label htmlFor="semanticEnabled" className="text-sm font-normal">
    Also find related references
  </Label>
</div>
```

**Note on Checkbox `name` attribute:** shadcn Checkbox is built on Radix UI's `CheckboxPrimitive`. Verify that the `name` attribute propagates to the underlying `<input>` element — Radix UI Checkbox renders a hidden `<input type="checkbox">` which carries the `name`. If `name` does not propagate, use a hidden `<input type="hidden">` pattern instead: render it with `value="on"` when checked, absent when unchecked (controlled with React state). [ASSUMED — need to verify with installed shadcn Checkbox implementation]

### Anti-Patterns to Avoid

- **Using `text-embedding-004`:** Shut down January 14, 2026. Will return 404. Use `gemini-embedding-001` everywhere. [VERIFIED: AI-SPEC Section 3 Common Pitfalls]
- **`Promise.all()` over all segments:** At 500 segments this fires 500+ concurrent API calls, causing HTTP 429 on the free tier. Use sequential chunk `for` loop inside `batchEmbed()`. [VERIFIED: AI-SPEC Section 4b]
- **`result.embedding` instead of `result.embeddings[0].values`:** v2 SDK returns `.embeddings` (plural array). Accessing `.embedding` returns `undefined` silently — cosine similarity then returns 0 for all segments with no error thrown. [VERIFIED: AI-SPEC Section 3 Common Pitfalls]
- **Removing exact matches in dedup:** The dedup step removes semantic matches whose `segmentIndices` overlap exact-match indices — it must NEVER remove the exact match entries themselves. The guard is `dedupedSemantic.filter(...)` applied only to `semanticMatches`, not to `exactMatches`. [VERIFIED: AI-SPEC Section 6 Guardrails]
- **Semantic failure breaking the job:** `findSemanticMatches()` must be wrapped in try/catch in `index.ts`. Throwing an unhandled exception there would cause the job to enter FAILED state even though exact matches are available. [VERIFIED: AI-SPEC Section 1 Critical Failure Modes]
- **`contents: text` instead of `contents: [text]`:** v2 `embedContent()` expects `string[]`, not a bare string. Pass `contents: [text]` even for single strings. [VERIFIED: AI-SPEC Section 3 Common Pitfalls]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cosine similarity | External vector similarity library | Pure math function (dot product / magnitudes) | Only 10 lines; no library dependency; vectors are already in memory as `number[]` arrays |
| Rate limiting | Token bucket / sleep loop | Sequential `for` loop in `batchEmbed()` with chunk size 20 | 500 segments = 25 sequential calls; well under 1500 RPM without any sleep |
| Embedding model | Custom fine-tuned embeddings | `gemini-embedding-001` via existing `@google/genai` SDK | Free tier, no new credentials, same vendor already accepted |
| Retry logic | Complex retry library | One-retry pattern from `notesGenerator.ts` (already in codebase) | Consistent with established project pattern; only transient 429 errors need retry |
| Checkbox form field | Custom accessible toggle | shadcn Checkbox component via `npx shadcn@latest add checkbox` | Consistent with project's component library; accessible by default |
| Schema validation for `semanticEnabled` | Manual boolean coercion | `z.coerce.boolean().optional().default(false)` | Handles all FormData edge cases (`null`, `'on'`, absent) correctly |

**Key insight:** The semantic matcher is intentionally a thin wrapper over a deterministic math operation. The only non-trivial engineering is the batch chunking strategy and soft-fail wrapping. Do not add abstraction layers that make it harder to debug API response shapes.

---

## Common Pitfalls

### Pitfall 1: Using `text-embedding-004`
**What goes wrong:** The Gemini API returns a model-not-found / 404 error. The job soft-fails with no semantic matches.
**Why it happens:** CONTEXT.md D-01 names `text-embedding-004`, but that model was shut down January 14, 2026. The correct model is `gemini-embedding-001`.
**How to avoid:** Use `const EMBEDDING_MODEL = 'gemini-embedding-001'` as a named constant. Never hardcode `text-embedding-004` anywhere.
**Warning signs:** `Error: models/text-embedding-004 is not found` in Railway logs. [VERIFIED: AI-SPEC Section 3]

### Pitfall 2: Dedup Bug Silently Drops Exact Matches
**What goes wrong:** A student searches a term verbatim in the video and it does not appear in the stitched video clip plan.
**Why it happens:** If dedup logic is applied to the merged array instead of only `semanticMatches`, exact-match entries can be incorrectly filtered out when a semantic match happens to share a segment index.
**How to avoid:** Apply `filter()` only to `semanticMatches` before merging: `dedupedSemantic = semanticMatches.filter(...)`. Never filter `exactMatches`.
**Warning signs:** Unit test for exact-match integrity (test where a topic is both verbatim and semantically matched) fails. [VERIFIED: AI-SPEC Section 5 Dimension 1]

### Pitfall 3: Checkbox `name` Attribute Not Propagating
**What goes wrong:** `formData.get('semanticEnabled')` returns `null` even when the user checked the box, because the shadcn Checkbox's `name` prop is not forwarded to the underlying hidden `<input>`.
**Why it happens:** Radix UI Checkbox renders a hidden `<input type="checkbox">`. If `name` prop forwarding is removed in a version, FormData will not include the field.
**How to avoid:** Inspect the installed `src/components/ui/checkbox.tsx` after `npx shadcn add checkbox`. If `name` is not forwarded, add a controlled React state with a companion `<input type="hidden" name="semanticEnabled" value={checked ? 'on' : 'off'} />`.
**Warning signs:** Server Action receives `semanticEnabled: false` regardless of checkbox state. [ASSUMED — based on Radix UI patterns]

### Pitfall 4: `segmentIndices` Array in Semantic Matches Has Wrong Index
**What goes wrong:** Semantic match `segmentIndices` points to the wrong segment, causing dedup logic to incorrectly include or exclude segments.
**Why it happens:** The `scored` array maps `segments.map((seg, i) => ({ seg, idx: i, ... }))`. If you use a variable other than `i` or re-index after filtering, indices diverge from the original `segments` array.
**How to avoid:** Always use the original `i` from `segments.map()` for `segmentIndices`, captured before any filtering.
**Warning signs:** Dedup test fails — a segment found by exact match at index N is not correctly excluded from semantic matches. [VERIFIED: AI-SPEC Section 4 implementation skeleton]

### Pitfall 5: Empty Embeddings Array on Partial API Response
**What goes wrong:** `batchEmbed()` receives a response where `response.embeddings` has fewer entries than `chunk.length`, causing index misalignment between `segVecs[i]` and `segments[i]`.
**Why it happens:** The Gemini API can return fewer embeddings than requested in edge cases (malformed content, token limit exceeded per string).
**How to avoid:** Add a length check: `if (embeddings.length !== chunk.length) throw new Error(...)`. This surfaces the problem immediately rather than silently misaligning indices.
**Warning signs:** Cosine similarity returns unexpected values (0.0 or NaN) for segments that should match. [VERIFIED: AI-SPEC Section 3 embedContent pattern]

### Pitfall 6: Prisma Field Not Surfaced in Worker Query
**What goes wrong:** `job.semanticEnabled` is `undefined` in the worker, so the semantic path never runs even when the user opted in.
**Why it happens:** `prisma.job.findFirst()` in `worker/src/index.ts` uses `findFirst({ where: { status: 'PENDING' } })` with no explicit `select` — Prisma returns all fields by default. If the Prisma client is not regenerated after the migration, the new field is absent from the TypeScript type.
**How to avoid:** After adding the migration and schema update, run `npm run build` in the worker (which runs `npx prisma generate`) before testing. The generated client will then include `semanticEnabled` in the returned Job type.
**Warning signs:** TypeScript compile error `Property 'semanticEnabled' does not exist on type 'Job'` in `index.ts`. [VERIFIED: established project pattern from prior phases]

---

## Code Examples

Verified patterns from codebase reading and AI-SPEC:

### @google/genai v2 embedContent() — correct shape
```typescript
// Source: AI-SPEC Section 3 (confirmed against worker/src/notesGenerator.ts SDK usage pattern)
// Note: response shape changed from v1 (.embedding.values) to v2 (.embeddings[].values)
const response = await ai.models.embedContent({
  model: 'gemini-embedding-001',
  contents: ['text string 1', 'text string 2'],  // string[] — NOT a bare string
  config: { taskType: 'SEMANTIC_SIMILARITY' },
})
// v2 shape: response.embeddings is ContentEmbedding[]
const values0 = response.embeddings?.[0]?.values  // number[], length 768
const values1 = response.embeddings?.[1]?.values  // number[], length 768
```

### Zod coerce.boolean() for checkbox FormData
```typescript
// Source: verified against Zod 4.4.3 installed in project (VERIFIED: local test)
// formData.get('semanticEnabled') returns:
//   'on'  when checkbox is checked (HTML form default value for checked checkboxes)
//   null  when checkbox is unchecked (field absent from FormData)
semanticEnabled: z.coerce.boolean().optional().default(false)
// Results:
//   'on'       -> true
//   null       -> false
//   undefined  -> false
//   absent {}  -> false
```

### Prisma Job model addition
```prisma
// Source: established pattern from Phase 5 studyNotes column (confirmed in schema.prisma)
model Job {
  // ... existing fields ...
  studyNotes      String?   // Phase 5
  semanticEnabled Boolean   @default(false)  // Phase 6
}
```

### Vitest mock pattern for @google/genai (follow notesGenerator.test.ts)
```typescript
// Source: worker/src/__tests__/notesGenerator.test.ts (confirmed in codebase)
const mockEmbedContent = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: function MockGoogleGenAI() {
    return {
      models: {
        embedContent: mockEmbedContent,
      },
    }
  },
}))
const { findSemanticMatches } = await import('../semanticMatcher.js')
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `text-embedding-004` | `gemini-embedding-001` | Jan 14, 2026 (shutdown) | Any call to old model returns 404; use new model name — API call syntax is identical |
| `@google/generative-ai` (v1 SDK) | `@google/genai` (v2 SDK) | Renamed 2025 | v2 changes import name, client init pattern (`new GoogleGenAI()`), and response shape (`.embeddings[]` plural) |
| `result.embedding.values` (v1) | `result.embeddings[0].values` (v2) | v2 SDK release | Accessing old path returns `undefined` silently; all similarity scores become 0 |
| `contents: "bare string"` | `contents: ["string"]` array | v2 SDK | v1 accepted bare strings; v2 requires array even for single input |

**Deprecated/outdated:**
- `text-embedding-004`: Shut down Jan 14, 2026. Use `gemini-embedding-001`.
- `@google/generative-ai` v1 SDK: Replaced by `@google/genai` v2. Already using v2 in this project (Phase 5).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | shadcn Checkbox component forwards `name` prop to underlying hidden `<input>` for FormData | Common Pitfalls #3, Code Examples | If not forwarded, FormData won't include `semanticEnabled`; need controlled state + hidden input workaround |
| A2 | `gemini-embedding-001` free tier limit is ~1500 RPM | Standard Stack | If lower, chunk strategy may need additional delays; if higher, no impact |
| A3 | `gemini-embedding-001` default embedding dimension is 768 float values | Code Examples | If different dimension, `assertValidEmbedding` dimension check may log spurious warnings (not a correctness issue) |

**All other claims are either VERIFIED against codebase files, npm registry, or CITED from AI-SPEC (which itself references official Gemini API docs).**

---

## Open Questions

1. **shadcn Checkbox `name` prop forwarding**
   - What we know: shadcn Checkbox uses Radix UI under the hood; Radix CheckboxPrimitive renders a hidden `<input>`. Whether `name` is forwarded depends on the shadcn template version.
   - What's unclear: The checkbox is not yet installed in this project, so the generated file cannot be inspected.
   - Recommendation: Run `npx shadcn@latest add checkbox` as Wave 2 task 1, then inspect `src/components/ui/checkbox.tsx` to confirm `name` forwarding. If absent, use controlled state + hidden input.

2. **Confidence display format in UI (MAT-04)**
   - What we know: AI-SPEC requires `matchType: 'semantic'` distinction and a confidence indicator. CONTEXT.md defers display format to Claude's discretion.
   - What's unclear: Whether v1 shows the confidence numerically, qualitatively, or not at all in the Transcript tab.
   - Recommendation: Phase 6 Plan 02 should make a concrete choice — the simplest v1 approach is a "(semantic)" label on matched segments in the Transcript tab, with no numeric score in the UI. The numeric `confidence` field is stored in `clipPlan` for future use.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@google/genai` SDK | `semanticMatcher.ts` | Yes | 2.10.0 (in `worker/package.json`) | — |
| `GEMINI_API_KEY` | `findSemanticMatches()` | Assumed yes (set in Phase 5) | — | Soft-fail returns `[]` |
| Prisma CLI | Schema migration | Yes | 7.8.0 | — |
| shadcn CLI | Add Checkbox component | Assumed yes (`shadcn` in root `package.json`) | 4.11.0 | Use native `<input type="checkbox">` |
| Vitest | `semanticMatcher.test.ts` | Yes | 4.1.8 | — |

**Missing dependencies with no fallback:** None — all required tools are present.

**Missing dependencies with fallback:**
- `GEMINI_API_KEY`: If not set, `findSemanticMatches()` soft-fails and returns empty array (by design).
- shadcn Checkbox: If CLI unavailable, use native HTML checkbox with the same `name="semanticEnabled"` attribute.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `worker/vitest.config.ts` |
| Quick run command | `cd worker && npm test -- --run src/__tests__/semanticMatcher.test.ts` |
| Full suite command | `cd worker && npm run test:run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAT-02 | `findSemanticMatches()` returns segments above SEMANTIC_THRESHOLD | unit | `cd worker && npm test -- --run src/__tests__/semanticMatcher.test.ts` | No — Wave 1 gap |
| MAT-03 | Exact matches never removed by dedup; dedup removes only semantic matches with overlapping indices | unit | same | No — Wave 1 gap |
| MAT-04 | Every returned ClipMatch has `matchType: 'semantic'` and `confidence` number 0-1 | unit | same | No — Wave 1 gap |
| SUB-04 | When `job.semanticEnabled === false`, `findSemanticMatches` is never called | unit | same | No — Wave 1 gap |
| SUB-04 | Soft-fail: when `findSemanticMatches` throws, job completes with exactMatches only | unit | same | No — Wave 1 gap |
| SUB-04 | When `GEMINI_API_KEY` absent, returns empty array without calling API | unit | same | No — Wave 1 gap |

### Sampling Rate

- **Per task commit:** `cd worker && npm test -- --run src/__tests__/semanticMatcher.test.ts`
- **Per wave merge:** `cd worker && npm run test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `worker/src/__tests__/semanticMatcher.test.ts` — unit tests for findSemanticMatches (all 6 behaviors above)
- [ ] `worker/src/__tests__/fixtures/semantic-eval-dataset.json` — reference dataset for eval (12-15 triples; per AI-SPEC Section 5)

*(Vitest and test infrastructure already installed; no framework setup needed)*

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 6 adds no new auth paths |
| V3 Session Management | No | No new session logic |
| V4 Access Control | No | No new access control paths; existing RLS on Job table covers `semanticEnabled` column |
| V5 Input Validation | Yes | `z.coerce.boolean().optional().default(false)` in Zod schema; prevents arbitrary values from reaching DB |
| V6 Cryptography | No | No cryptographic operations; embeddings are not secrets |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-side toggle manipulation | Tampering | Zod schema coerces and defaults; Prisma `@default(false)` is the authoritative DB default; Server Action is the only write path (RLS) |
| Prompt injection via `topic` field into embedding | Tampering | Topic string is embedded as-is; embedding models are not generative — injected instructions have no effect on cosine similarity computation |
| API key leakage | Information Disclosure | `GEMINI_API_KEY` is worker-only environment variable; never in `NEXT_PUBLIC_` prefix; never returned to client |
| Cost amplification via semanticEnabled=true on large transcripts | Elevation of Privilege | `MAX_SEMANTIC_MATCHES = 10` caps output; `EMBED_CHUNK_SIZE = 20` with sequential calls prevents burst-429; free tier limits bound total cost |

**No new security surface beyond what is already present in Phase 5 (Gemini API key, Job model).**

---

## Sources

### Primary (HIGH confidence)
- `worker/src/notesGenerator.ts` — Established `@google/genai` v2 import pattern, retry logic, soft-fail; confirmed in codebase read
- `worker/src/types.ts` — Current `ClipMatch` and `TranscriptSegment` interfaces; confirmed in codebase read
- `worker/src/index.ts` — Integration point at line 88 (`buildClipPlan()`); processing loop structure; confirmed in codebase read
- `worker/src/__tests__/notesGenerator.test.ts` — `vi.mock('@google/genai')` pattern for testing; confirmed in codebase read
- `prisma/schema.prisma` — Current Job model; migration required; confirmed in codebase read
- `src/lib/schemas.ts` — Current Zod schema; extension point identified; confirmed in codebase read
- `src/components/submission-form.tsx` — Form structure; checkbox insertion point identified; confirmed in codebase read
- `worker/package.json` — `@google/genai@^2.10.0` already installed; confirmed
- Local Zod test — `z.coerce.boolean()` behavior with `'on'`, `null`, `undefined` confirmed against installed Zod 4.4.3

### Secondary (MEDIUM confidence)
- `.planning/phases/06-optional-semantic-matching/06-AI-SPEC.md` — Complete implementation skeleton, model config, eval strategy, guardrails; AI-generated design contract
- `.planning/phases/06-optional-semantic-matching/06-CONTEXT.md` — Locked decisions D-01 through D-07; discussion outcome
- npm registry — `@google/genai` v2.10.0 confirmed latest; created 2025-03-11; 17.2M weekly downloads; no postinstall scripts

### Tertiary (LOW confidence)
- Model dimension assumption (768 floats for `gemini-embedding-001`) — from AI-SPEC Section 4; not independently verified against live API

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages already installed and version-confirmed
- Architecture: HIGH — all patterns sourced from existing codebase files and AI-SPEC
- Pitfalls: HIGH — sourced from AI-SPEC (itself grounded in official Gemini v2 migration docs) and codebase analysis
- Test patterns: HIGH — confirmed from existing notesGenerator.test.ts in codebase

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 (Gemini embedding model deprecations; check ai.google.dev/gemini-api/docs/deprecations before implementation if >30 days elapsed)
