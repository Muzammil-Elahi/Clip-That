# Phase 2: Transcript and Exact Search - Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 9
**Analogs found:** 7 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `prisma/schema.prisma` | model/config | CRUD | `prisma/schema.prisma` (self) | exact (modification) |
| `src/types/job.ts` | model | transform | `src/types/job.ts` (self) | exact (modification) |
| `worker/package.json` | config | — | root `package.json` | partial |
| `worker/src/index.ts` | service | event-driven (polling) | `src/lib/prisma.ts` + RESEARCH patterns | role-match |
| `worker/src/prisma.ts` | utility | CRUD | `src/lib/prisma.ts` | exact |
| `worker/src/transcript.ts` | service | request-response | `src/actions/submit-job.ts` (error mapping pattern) | role-match |
| `worker/src/matcher.ts` | utility | transform | `src/lib/youtube.ts` (pure utility, no deps) | role-match |
| `worker/src/__tests__/transcript.test.ts` | test | — | `src/__tests__/submit-job.test.ts` | exact |
| `worker/src/__tests__/matcher.test.ts` | test | — | `src/__tests__/youtube.test.ts` | exact |
| `worker/vitest.config.ts` | config | — | `vitest.config.mts` | role-match |

---

## Pattern Assignments

### `prisma/schema.prisma` (model, CRUD — modification)

**Analog:** `prisma/schema.prisma` (current file, lines 18–29)

**Existing Job model** (lines 18–29):
```prisma
model Job {
  id           String    @id @default(uuid())
  userId       String
  youtubeUrl   String
  topic        String
  status       JobStatus @default(PENDING)
  errorMessage String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([userId])
}
```

**Add after `errorMessage String?`** — two new nullable JSON columns:
```prisma
  transcript   Json?
  clipPlan     Json?
```

**Note:** The datasource block intentionally has no `url` field — it is managed by `prisma.config.ts` (line 8 comment). Do not add a url field.

---

### `src/types/job.ts` (model, transform — modification)

**Analog:** `src/types/job.ts` (lines 1–26)

**Existing interface pattern** (lines 16–25) — mirror every Prisma model field as a serialisation-safe type:
```typescript
export interface Job {
  id: string
  userId: string
  youtubeUrl: string
  topic: string
  status: JobStatus
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}
```

**Extend with new JSON fields** — add after `errorMessage`:
```typescript
  transcript:  TranscriptSegment[] | null
  clipPlan:    ClipMatch[] | null
```

**Add new type declarations above the Job interface** (following the same JSDoc comment style as lines 1–10):
```typescript
export interface TranscriptSegment {
  text: string
  offset: number     // seconds from video start — NOT 'start'
  duration: number   // seconds
  lang: string
}

export interface ClipMatch {
  startMs: number          // Math.round(segment.offset * 1000)
  endMs: number            // Math.round((segment.offset + segment.duration) * 1000)
  text: string             // raw transcript text of matched segment(s)
  segmentIndices: number[] // indices into transcript array (for Phase 3)
}
```

---

### `worker/src/prisma.ts` (utility, CRUD)

**Analog:** `src/lib/prisma.ts` (lines 1–19) — exact same pattern, different env var and no global singleton (worker is a long-running process, not serverless).

**Copy from `src/lib/prisma.ts`** (lines 1–19):
```typescript
import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
```

**Worker variant** — drop the global singleton (not needed in a persistent process):
```typescript
import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.WORKER_DATABASE_URL!,  // service role URL — bypasses RLS
})

export const prisma = new PrismaClient({ adapter })
```

**Key differences from Next.js client:**
- Uses `WORKER_DATABASE_URL` (service role postgres URL), not `DATABASE_URL` (anon pooler)
- No `globalForPrisma` singleton — worker is a long-running process, not serverless with hot-reload
- Path to generated client is `../../prisma/generated/prisma/client` (relative from `worker/src/`)

---

### `worker/src/index.ts` (service, polling / event-driven)

**Analog:** RESEARCH.md Patterns 1 and 2 (no direct codebase analog — first worker file)

**Env loading pattern** — copy from `prisma.config.ts` lines 1–5:
```typescript
import { config } from 'dotenv'
config({ path: '../.env.local' })  // worker runs from worker/ subdir
```

**Prisma update pattern** — copy from `src/actions/submit-job.ts` lines 64–72:
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
Worker mirrors this shape for `prisma.job.update()` with `status: 'PROCESSING'`, `status: 'DONE'`, `status: 'FAILED'`.

**Error handling pattern** — copy from `src/actions/submit-job.ts` lines 63–75 (try/catch, plain-language error string):
```typescript
try {
  // ...
} catch {
  return { error: 'Failed to create job — please try again.' }
}
```

**Graceful shutdown pattern** (from RESEARCH.md Pattern 1):
```typescript
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))
let shutdown = false

process.on('SIGTERM', async () => {
  shutdown = true
  await prisma.$disconnect()
  process.exit(0)
})

async function main() {
  while (!shutdown) {
    await processPendingJob()
    await sleep(4000)
  }
}

main().catch(err => {
  console.error('Worker fatal error:', err)
  process.exit(1)
})
```

---

### `worker/src/transcript.ts` (service, request-response)

**Analog:** `src/actions/submit-job.ts` — error-catch-return-string pattern (lines 63–75)

**Error handling pattern to copy from `src/actions/submit-job.ts`** (lines 63–75):
```typescript
try {
  // operation
} catch {
  return { error: 'Failed to create job — please try again.' }
}
```

**Adapted for transcript** — translate library errors to plain-language strings matching Phase 1 D-11 convention (same style as `submit-job.ts` error strings):
```typescript
import {
  YoutubeTranscript,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptInvalidVideoIdError,
} from 'youtube-transcript-plus'

export async function fetchTranscript(videoId: string) {
  return YoutubeTranscript.fetchTranscript(videoId, { retries: 2, retryDelay: 1000 })
}

export function mapTranscriptError(err: unknown): string {
  if (err instanceof YoutubeTranscriptNotAvailableError ||
      err instanceof YoutubeTranscriptDisabledError) {
    return "This video doesn't have a usable transcript."
  }
  if (err instanceof YoutubeTranscriptVideoUnavailableError) {
    return "This video is unavailable."
  }
  if (err instanceof YoutubeTranscriptTooManyRequestError) {
    return "YouTube is temporarily unavailable. Please try again in a few minutes."
  }
  if (err instanceof YoutubeTranscriptInvalidVideoIdError) {
    return "Invalid YouTube video URL."
  }
  return "Failed to retrieve transcript. Please try again."
}
```

**Plain-language error string style** (D-11): Single sentence. Starts with uppercase. Ends with period. No technical jargon. Matches the exact tone of `src/actions/submit-job.ts` lines 58 and 74.

---

### `worker/src/matcher.ts` (utility, transform)

**Analog:** `src/lib/youtube.ts` — pure utility module, no framework dependencies, exported functions only (lines 1–24)

**Module shape to copy from `src/lib/youtube.ts`** (lines 1–17):
```typescript
/**
 * [JSDoc describing module purpose]
 */

export function functionName(input: type): returnType {
  // ...
}
```

**No imports from `@/` paths** — `src/lib/youtube.ts` uses no path aliases and neither should `worker/src/matcher.ts`. All imports are relative or from `node_modules`.

**Core normalize + match pattern** (from RESEARCH.md Pattern 4):
```typescript
import type { TranscriptSegment, ClipMatch } from './types.js'

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findMatches(segments: TranscriptSegment[], topic: string): ClipMatch[] {
  const normTopic = normalize(topic)
  const matches: ClipMatch[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const normSeg = normalize(seg.text)

    if (normSeg.includes(normTopic)) {
      matches.push({
        startMs: Math.round(seg.offset * 1000),
        endMs: Math.round((seg.offset + seg.duration) * 1000),
        text: seg.text,
        segmentIndices: [i],
      })
      continue
    }

    if (i + 1 < segments.length) {
      const nextSeg = segments[i + 1]
      const combined = normalize(seg.text + ' ' + nextSeg.text)
      if (combined.includes(normTopic)) {
        matches.push({
          startMs: Math.round(seg.offset * 1000),
          endMs: Math.round((nextSeg.offset + nextSeg.duration) * 1000),
          text: seg.text + ' ' + nextSeg.text,
          segmentIndices: [i, i + 1],
        })
        i++
      }
    }
  }

  return matches
}
```

**Critical field name:** Use `seg.offset` (not `seg.start`) — the library returns `offset`. TypeScript will catch this if `TranscriptSegment` is imported with the correct type.

---

### `worker/src/__tests__/matcher.test.ts` (test, transform)

**Analog:** `src/__tests__/youtube.test.ts` (lines 1–54) — pure unit test of a utility module, no mocks needed

**Test file structure to copy from `src/__tests__/youtube.test.ts`** (lines 1–6):
```typescript
import { describe, it, expect } from 'vitest'
import { normalize, findMatches } from '../matcher.js'
```

**describe/it/expect pattern** (lines 4–10):
```typescript
describe('normalize', () => {
  it('lowercases input', () => {
    expect(normalize('Hello World')).toBe('hello world')
  })
  // ...
})
```

**Note:** Worker tests use `.js` extensions on relative imports (ESM requirement with `"type": "module"`), unlike the Next.js tests which use `@/` aliases resolved by `vite-tsconfig-paths`.

---

### `worker/src/__tests__/transcript.test.ts` (test, request-response)

**Analog:** `src/__tests__/submit-job.test.ts` (lines 1–82) — tests a function that performs I/O by exercising only the exported schema/helper (no actual network calls)

**Test structure pattern from `src/__tests__/submit-job.test.ts`** (lines 1–5):
```typescript
import { describe, it, expect } from 'vitest'
import { submitJobSchema } from '@/actions/submit-job'
```

**Mock pattern for library errors** — Vitest `vi.mock()` to stub `youtube-transcript-plus`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { mapTranscriptError } from '../transcript.js'
import { YoutubeTranscriptNotAvailableError } from 'youtube-transcript-plus'

describe('mapTranscriptError', () => {
  it('returns no-transcript message for NotAvailableError', () => {
    const err = new YoutubeTranscriptNotAvailableError('vid123')
    expect(mapTranscriptError(err)).toBe("This video doesn't have a usable transcript.")
  })
})
```

---

### `worker/vitest.config.ts` (config)

**Analog:** `vitest.config.mts` (lines 1–13) — root Vitest config

**Copy structure from `vitest.config.mts`** (lines 1–13):
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [],          // no react plugin — worker has no React components
  test: {
    environment: 'node',   // not jsdom — worker is pure Node.js
    globals: true,
    setupFiles: [],        // no @testing-library/jest-dom — worker has no DOM
    include: ['src/__tests__/**/*.{test,spec}.ts'],
  },
})
```

**Key difference from root config:** `environment: 'node'` (not `jsdom`), no React plugin, no setup file importing `@testing-library/jest-dom`.

---

## Shared Patterns

### Plain-Language Error Strings
**Source:** `src/actions/submit-job.ts` lines 58 and 74
**Apply to:** `worker/src/transcript.ts` `mapTranscriptError()` return values, `worker/src/index.ts` FAILED error messages

Convention: Single declarative sentence, uppercase first letter, period at end, no stack trace or error code in the message.
```typescript
// From submit-job.ts line 58:
return { error: 'No session — please refresh and try again.' }
// From submit-job.ts line 74:
return { error: 'Failed to create job — please try again.' }
```

### Prisma Client Instantiation (PrismaClient + PrismaPg adapter)
**Source:** `src/lib/prisma.ts` lines 1–19
**Apply to:** `worker/src/prisma.ts`

Pattern: Import `PrismaClient` from the generated output path, instantiate `PrismaPg` with a connection string env var, pass adapter to `new PrismaClient({ adapter })`.

```typescript
import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
export const prisma = new PrismaClient({ adapter })
```

### Prisma Job Update (status + payload)
**Source:** `src/actions/submit-job.ts` lines 64–72
**Apply to:** `worker/src/index.ts` all `prisma.job.update()` calls

Pattern: `prisma.job.update({ where: { id }, data: { ...fields } })`. For JSON columns, cast with `as unknown as Prisma.InputJsonValue`.

### Dotenv Loading
**Source:** `prisma.config.ts` lines 1–5
**Apply to:** `worker/src/index.ts` top of file (before any env var access)

```typescript
import { config } from 'dotenv'
config({ path: '.env.local' })
```

### Vitest Test Structure
**Source:** `src/__tests__/youtube.test.ts` lines 1–6
**Apply to:** All `worker/src/__tests__/*.test.ts` files

```typescript
import { describe, it, expect } from 'vitest'
// named import from the module under test using relative path with .js extension
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `worker/package.json` | config | — | No existing `worker/` subpackage; must be authored from scratch following root `package.json` conventions but with `"type": "module"` for ESM |

---

## Critical Anti-Patterns (from RESEARCH.md)

These patterns exist in the current codebase and must NOT be copied into the worker:

| Do Not Copy | From | Why |
|---|---|---|
| `@/` path aliases in imports | `src/actions/submit-job.ts` line 4 (`@/lib/prisma`) | The `@/` alias is configured in the Next.js tsconfig and is unavailable in `worker/`. Use relative imports with `.js` extensions. |
| `globalForPrisma` singleton pattern | `src/lib/prisma.ts` lines 14–17 | Only needed to survive serverless hot-reload. Worker is a persistent process — instantiate Prisma once at module level without the global. |
| `environment: 'jsdom'` in Vitest config | `vitest.config.mts` line 8 | Worker tests run in Node, not a browser context. |
| `setupFiles: ['./src/__tests__/setup.ts']` | `vitest.config.mts` line 10 | The setup file imports `@testing-library/jest-dom`, which is for React component tests. Worker tests have no DOM. |

---

## Metadata

**Analog search scope:** `src/`, `prisma/`, project root config files
**Files scanned:** 10
**Pattern extraction date:** 2026-06-16
