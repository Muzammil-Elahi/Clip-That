# Phase 06: Optional Semantic Matching - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `worker/src/semanticMatcher.ts` | service | request-response (Gemini API) | `worker/src/notesGenerator.ts` | exact |
| `worker/src/__tests__/semanticMatcher.test.ts` | test | — | `worker/src/__tests__/notesGenerator.test.ts` | exact |
| `worker/src/__tests__/fixtures/semantic-eval-dataset.json` | config | — | (no analog — new fixture format) | none |
| `worker/src/types.ts` | model | — | `src/types/job.ts` | exact (mirror) |
| `worker/src/index.ts` | service | batch | `worker/src/index.ts` (self, lines 88–103) | exact |
| `src/types/job.ts` | model | — | `worker/src/types.ts` | exact (mirror) |
| `prisma/schema.prisma` | config | — | `prisma/schema.prisma` (self, studyNotes line) | exact |
| `src/lib/schemas.ts` | utility | — | `src/lib/schemas.ts` (self) | exact |
| `src/actions/submit-job.ts` | controller | request-response | `src/actions/submit-job.ts` (self) | exact |
| `src/components/submission-form.tsx` | component | request-response | `src/components/submission-form.tsx` (self, lines 88–111) | exact |

---

## Pattern Assignments

### `worker/src/semanticMatcher.ts` (service, request-response)

**Analog:** `worker/src/notesGenerator.ts`

**Imports pattern** (lines 1–9 of notesGenerator.ts):
```typescript
import { GoogleGenAI } from '@google/genai'
import type { StitchedTranscriptEntry } from './types.js'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))
```
Copy this verbatim; replace the type import with `TranscriptSegment, ClipMatch` from `./types.js`. Add named constants block below `ai` init:
```typescript
const EMBEDDING_MODEL      = 'gemini-embedding-001'  // text-embedding-004 shut down Jan 14 2026
const SEMANTIC_THRESHOLD   = 0.75
const MAX_SEMANTIC_MATCHES = 10
const EMBED_CHUNK_SIZE     = 20
```

**Soft-fail + API key guard pattern** (notesGenerator.ts lines 42–46):
```typescript
export async function generateStudyNotes(...): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('  GEMINI_API_KEY not set — skipping note generation (soft-fail)')
    return null
  }
```
Copy guard to `findSemanticMatches()`: return `[]` instead of `null`.

**Retry pattern** (notesGenerator.ts lines 51–67):
```typescript
for (let attempt = 0; attempt <= 1; attempt++) {
  try {
    const response = await ai.models.generateContent({ ... })
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
```
Apply the same 0/1 attempt loop inside `embedWithRetry()`. Check for `'429'` in `err.message` on attempt 0 (only retry on rate-limit, unlike notesGenerator which retries any error). Throw on attempt 1.

**Core embedding pattern** (from RESEARCH.md verified against `@google/genai` v2):
```typescript
// v2 SDK: embedContent takes string[] in contents, returns .embeddings (plural array)
const response = await ai.models.embedContent({
  model: EMBEDDING_MODEL,
  contents: chunk,                              // string[] — NOT a bare string
  config: { taskType: 'SEMANTIC_SIMILARITY' },
})
const embeddings = response.embeddings ?? []
// Guard: length must match chunk.length — throw if not
if (embeddings.length !== chunk.length) {
  throw new Error(`Expected ${chunk.length} embeddings, got ${embeddings.length}`)
}
results.push(...embeddings.map(e => e.values ?? []))
```

**Return shape** — mirrors `findMatches()` in `worker/src/matcher.ts` (lines 37–43):
```typescript
matches.push({
  startMs: Math.round(seg.offset * 1000),
  endMs:   Math.round((seg.offset + seg.duration) * 1000),
  text:    seg.text,
  segmentIndices: [i],
})
```
Semantic version adds `matchType: 'semantic' as const` and `confidence: Math.round(score * 100) / 100`.

---

### `worker/src/__tests__/semanticMatcher.test.ts` (test)

**Analog:** `worker/src/__tests__/notesGenerator.test.ts`

**Mock pattern** (notesGenerator.test.ts lines 1–18):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { StitchedTranscriptEntry } from '../types.js'

const mockGenerateContent = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: function MockGoogleGenAI() {
    return {
      models: {
        generateContent: mockGenerateContent,
      },
    }
  },
}))

const { generateStudyNotes } = await import('../notesGenerator.js')
```
For `semanticMatcher.test.ts`, replace `generateContent` with `embedContent`, rename mock to `mockEmbedContent`, and import `findSemanticMatches` from `'../semanticMatcher.js'`.

**beforeEach / afterEach pattern** (notesGenerator.test.ts lines 28–34):
```typescript
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  process.env.GEMINI_API_KEY = 'test-api-key'
})

afterEach(() => {
  vi.useRealTimers()
  delete process.env.GEMINI_API_KEY
})
```
Copy verbatim — fake timers needed for the 2s sleep inside `embedWithRetry`.

**Test structure** (notesGenerator.test.ts lines 36–76 — four test cases):
Mirror the same four coverage points for `semanticMatcher`:
1. Happy path — segments above threshold appear in result with `matchType: 'semantic'` and numeric `confidence`
2. Soft-fail — API throws on both attempts; `findSemanticMatches` returns `[]` without throwing
3. Retry — first call throws 429, second resolves; result is non-empty
4. Missing `GEMINI_API_KEY` — returns `[]` without calling `embedContent`

Add two more tests unique to semantic matching:
5. Threshold filter — segments with score < `SEMANTIC_THRESHOLD` are excluded
6. `segmentIndices` integrity — returned `segmentIndices[0]` equals the original segment's position in the input array

---

### `worker/src/types.ts` (model — modification)

**Analog:** `src/types/job.ts` (mirror file — lines 27–32 of job.ts)

**Current ClipMatch interface** (worker/src/types.ts lines 17–25):
```typescript
export interface ClipMatch {
  startMs: number          // Math.round(segment.offset * 1000)
  endMs: number            // Math.round((segment.offset + segment.duration) * 1000)
  text: string             // raw transcript text of matched segment(s)
  segmentIndices: number[] // indices into transcript array (for Phase 3)
}
```

**Add after `segmentIndices`** (keep optional — zero changes to exact-match code):
```typescript
  // Phase 6 additions — optional so exact-match code requires zero changes
  matchType?:  'exact' | 'semantic'
  confidence?: number  // cosine similarity 0–1, 2 decimal places
```

---

### `src/types/job.ts` (model — modification)

**Analog:** `worker/src/types.ts` (mirror)

Apply the identical `matchType?` / `confidence?` additions to `ClipMatch` at line 27–32. Also add `semanticEnabled` to the `Job` interface (lines 48–63), following the pattern of `studyNotes` at line 61:
```typescript
studyNotes:         string | null                      // Phase 5
semanticEnabled:    boolean                             // Phase 6
```

---

### `worker/src/index.ts` (service — modification)

**Analog:** `worker/src/index.ts` itself — follow the Phase 5 pattern at lines 97–103 for adding a new optional step after the main pipeline step.

**Phase 5 soft-fail pattern** (index.ts lines 97–103):
```typescript
// Phase 5: study notes generation
console.log('  generating study notes...')
const studyNotes = await generateStudyNotes(stitchedTranscript, job.topic)
if (studyNotes) {
  console.log('  study notes generated ✓')
} else {
  console.log('  study notes soft-failed (null) — job will still complete')
}
```

**Phase 6 integration replaces line 88** (`const clipPlan = buildClipPlan(segments, job.topic)`):
```typescript
// Phase 6: semantic matching (optional — guarded by job.semanticEnabled)
const exactMatches = buildClipPlan(segments, job.topic)
console.log(`  clipPlan (exact): ${exactMatches.length} matches`)

let semanticMatches: ClipMatch[] = []
if (job.semanticEnabled) {
  try {
    semanticMatches = await findSemanticMatches(segments, job.topic)
    console.log(`  semantic matches: ${semanticMatches.length}`)
  } catch (err) {
    console.error('  Semantic matching failed (soft-fail, exact matches preserved):', err)
  }
}

const exactIndices = new Set(exactMatches.flatMap(m => m.segmentIndices))
const dedupedSemantic = semanticMatches.filter(
  m => !m.segmentIndices.some(i => exactIndices.has(i)),
)
const clipPlan = [...exactMatches, ...dedupedSemantic]
```

Add import at top of file alongside existing worker imports (lines 12–15 pattern):
```typescript
import { findSemanticMatches } from './semanticMatcher.js'
import type { ClipMatch } from './types.js'
```

---

### `prisma/schema.prisma` (config — modification)

**Analog:** `prisma/schema.prisma` itself — follow the Phase 5 `studyNotes` addition pattern (line 31).

**Current last field before timestamps** (lines 30–31):
```prisma
studyNotes  String?   // Phase 5: AI-generated study notes Markdown text
```

**Add after `studyNotes`:**
```prisma
studyNotes      String?   // Phase 5: AI-generated study notes Markdown text
semanticEnabled Boolean   @default(false)  // Phase 6: user opted into semantic matching
```

Migration command (same as every prior phase):
```bash
npx prisma migrate dev --name add_semantic_enabled
```

---

### `src/lib/schemas.ts` (utility — modification)

**Analog:** `src/lib/schemas.ts` itself (lines 1–13 — the full file).

**Current schema** (lines 4–13):
```typescript
export const submitJobSchema = z.object({
  youtubeUrl: z
    .string()
    .url({ message: 'Enter a valid YouTube video URL.' })
    .refine(isYouTubeUrl, { message: 'Enter a valid YouTube video URL.' }),
  topic: z
    .string()
    .min(2, 'Enter at least 2 characters.')
    .max(200, 'Keep it under 200 characters.'),
})
```

**Add `semanticEnabled` after `topic`:**
```typescript
  semanticEnabled: z.coerce.boolean().optional().default(false),
```
`z.coerce.boolean()` handles all FormData edge cases: `'on'` -> `true`, `null` -> `false`, absent field -> `false`. No other change to the schema.

---

### `src/actions/submit-job.ts` (controller — modification)

**Analog:** `src/actions/submit-job.ts` itself — follow the existing pattern for reading validated fields and passing to `prisma.job.create()`.

**Current safeParse call** (lines 29–32):
```typescript
const result = submitJobSchema.safeParse({
  youtubeUrl: formData.get('youtubeUrl'),
  topic: formData.get('topic'),
})
```

**Add `semanticEnabled`:**
```typescript
const result = submitJobSchema.safeParse({
  youtubeUrl:      formData.get('youtubeUrl'),
  topic:           formData.get('topic'),
  semanticEnabled: formData.get('semanticEnabled'),
})
```

**Current job.create call** (lines 49–54):
```typescript
const job = await prisma.job.create({
  data: {
    userId: user.id,
    youtubeUrl,
    topic,
    status: 'PENDING',
  },
})
```

**Add `semanticEnabled` from destructured result.data:**
```typescript
const { youtubeUrl, topic, semanticEnabled } = result.data
// ...
const job = await prisma.job.create({
  data: {
    userId: user.id,
    youtubeUrl,
    topic,
    status: 'PENDING',
    semanticEnabled,
  },
})
```

---

### `src/components/submission-form.tsx` (component — modification)

**Analog:** `src/components/submission-form.tsx` itself — follow the `Label` + `Input` field pattern at lines 88–111 (topic field).

**Existing field pattern** (lines 88–111):
```typescript
{/* Topic field */}
<div className="flex flex-col gap-2">
  <Label htmlFor="topic">Topic or phrase</Label>
  <Input
    id="topic"
    name="topic"
    type="text"
    placeholder="..."
    disabled={isPending}
  />
</div>
```

**New checkbox block** — insert between topic field closing `</div>` (line 111) and Submit button `<Button>` (line 114):
```typescript
{/* Semantic matching toggle */}
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

**New import to add** at top of file alongside existing UI component imports (lines 6–11):
```typescript
import { Checkbox } from '@/components/ui/checkbox'
```

**Note:** After running `npx shadcn@latest add checkbox`, inspect `src/components/ui/checkbox.tsx` to verify the `name` prop is forwarded to the underlying hidden `<input>`. If absent, use controlled React state with `<input type="hidden" name="semanticEnabled" value={checked ? 'on' : ''} />` companion.

---

### `src/components/ui/checkbox.tsx` (component — new)

**Analog:** `src/components/ui/input.tsx` or `src/components/ui/button.tsx` — shadcn component file structure.

**No pattern extraction needed** — this file is generated by shadcn CLI (`npx shadcn@latest add checkbox`). Do not hand-roll it. After generation, only read it to verify `name` prop forwarding (see above).

---

## Shared Patterns

### Gemini SDK Import and Init
**Source:** `worker/src/notesGenerator.ts` lines 6–9
**Apply to:** `worker/src/semanticMatcher.ts`
```typescript
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })
```
The `ai` instance is module-level (initialized once). Both notesGenerator and semanticMatcher follow this pattern.

### Soft-Fail with API Key Guard
**Source:** `worker/src/notesGenerator.ts` lines 42–46
**Apply to:** `worker/src/semanticMatcher.ts` (`findSemanticMatches`)
```typescript
if (!process.env.GEMINI_API_KEY) {
  console.warn('  GEMINI_API_KEY not set — skipping note generation (soft-fail)')
  return null  // semanticMatcher returns [] instead
}
```

### Retry with 2s Sleep
**Source:** `worker/src/notesGenerator.ts` lines 51–67
**Apply to:** `worker/src/semanticMatcher.ts` (`embedWithRetry` wrapper)
```typescript
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

for (let attempt = 0; attempt <= 1; attempt++) {
  try {
    return await <API_CALL>
  } catch (err) {
    if (attempt === 0) {
      console.warn('  Gemini attempt 1 failed, retrying in 2s...', err)
      await sleep(2000)
    } else {
      // log error; return fallback
    }
  }
}
```

### Vitest Mock for @google/genai
**Source:** `worker/src/__tests__/notesGenerator.test.ts` lines 6–15
**Apply to:** `worker/src/__tests__/semanticMatcher.test.ts`
```typescript
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

### Zod Schema Extension Pattern
**Source:** `src/lib/schemas.ts` lines 4–13 (full file)
**Apply to:** `src/lib/schemas.ts` (add `semanticEnabled` field)
New field follows the same `z.object()` member pattern; `z.coerce.boolean().optional().default(false)` is the correct type for checkbox FormData.

### Prisma Schema Column Addition
**Source:** `prisma/schema.prisma` line 31 (`studyNotes String?`)
**Apply to:** `prisma/schema.prisma` (add `semanticEnabled Boolean @default(false)`)
Field placed after `studyNotes` before `createdAt`. Uses `@default(false)` — no nullable (`?`) because Boolean with default is never null.

### ClipMatch Interface Extension (Both Files)
**Source:** `worker/src/types.ts` lines 17–25 AND `src/types/job.ts` lines 27–32
**Apply to:** Both files — must be kept in sync (project convention noted in both files' comments)
Optional fields only — existing exact-match code (`matcher.ts`, `contextExpander.ts`) requires zero changes.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `worker/src/__tests__/fixtures/semantic-eval-dataset.json` | config | — | No JSON eval fixture pattern exists yet; format is 12–15 triples of `{ topic, segmentText, expectedMatch: boolean }` per AI-SPEC Section 5 |

---

## Metadata

**Analog search scope:** `worker/src/`, `src/actions/`, `src/components/`, `src/lib/`, `src/types/`, `prisma/`
**Files scanned:** 10 source files read directly
**Pattern extraction date:** 2026-06-28

**Critical model name:** Use `gemini-embedding-001` everywhere. `text-embedding-004` was shut down January 14, 2026 — any use returns 404.

**Critical SDK shape:** `@google/genai` v2 returns `response.embeddings` (plural array of `ContentEmbedding`). Access values via `response.embeddings[0].values`, NOT `response.embedding.values` (v1 path — returns `undefined` silently in v2).
