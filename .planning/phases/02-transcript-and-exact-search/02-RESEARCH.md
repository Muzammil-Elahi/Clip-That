# Phase 2: Transcript and Exact Search - Research

**Researched:** 2026-06-16
**Domain:** YouTube transcript retrieval, Node.js worker process, Prisma JSON columns, exact text matching
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Transcript library — `youtube-transcript-plus` npm package. Free, no API key needed, uses YouTube's internal caption endpoint.
- **D-02:** Transcript format — Keep the raw `{text, start, duration}` array as returned by the library. No conversion step in Phase 2.
- **D-03:** No-transcript handling — Set job status to `FAILED` with a specific user-facing error message (e.g., "This video doesn't have a usable transcript.").
- **D-04:** Transcript storage — JSON column on the `Job` table (`transcript Json?` in Prisma schema).
- **D-05:** Clip plan storage — JSON column on the `Job` table (`clipPlan Json?` in Prisma schema).
- **D-06:** Normalization — Strip punctuation, normalize whitespace, lowercase both the topic and each transcript segment.
- **D-07:** Multi-word phrases — Adjacent phrase matching. Topic words must appear in order and adjacent in normalized text.
- **D-08:** Cross-segment check — Also check consecutive segment pairs by concatenating adjacent segments.
- **D-09:** Worker location — Scaffold the Railway worker process in Phase 2.
- **D-10:** Job pickup — Polling loop. Worker queries Supabase for `PENDING` jobs on a short interval (every 3–5 seconds).

### Claude's Discretion

- Polling interval for the worker loop (3–5 seconds is a reasonable default).
- Exact Prisma field names for the new JSON columns (`transcript`, `clipPlan` or similar).
- ClipPlan JSON shape (array of `{startMs, endMs, text, segmentIndices}` or similar — must include source timestamps for Phase 3).
- Worker project structure (monorepo subfolder vs. separate `worker/` directory at project root).
- Error handling and retry behavior within the worker for transient YouTube API failures.

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-03 | User can choose exact transcript matching | No new UI — exact matching is the only mode in Phase 2; the submit form already captures the topic field |
| TRN-01 | System can retrieve timestamped transcript/caption data for supported YouTube videos | `youtube-transcript-plus` `fetchTranscript()` returns `TranscriptSegment[]` with `offset` (seconds), `duration` (seconds), `text`, `lang` |
| TRN-02 | System detects when a video has no usable transcript and returns a clear unsupported-video state | Catch `YoutubeTranscriptNotAvailableError`, `YoutubeTranscriptDisabledError`, `YoutubeTranscriptVideoUnavailableError` → set job to FAILED |
| TRN-03 | System normalizes transcript text for matching while preserving source timestamps | Normalize text only; store raw `offset`/`duration` values unchanged on each segment |
| MAT-01 | System finds direct topic mentions using exact matching | Lowercase + strip punctuation + check `normalizedTopic` is a substring of the concatenated normalized segment text |
| CLP-01 | System creates a clip plan from all relevant transcript segments | Write `clipPlan Json?` to Job row: array of match records with source timestamps |

</phase_requirements>

---

## Summary

Phase 2 adds a standalone Node.js worker process (deployed separately on Railway) that polls Supabase for `PENDING` jobs, fetches the YouTube transcript, runs exact topic matching, and writes the results back to the `Job` row as two new JSON columns (`transcript` and `clipPlan`). The Next.js web app requires no new routes — the existing Realtime subscription already propagates `PROCESSING → DONE/FAILED` status changes to the browser.

The critical API detail is that `youtube-transcript-plus` v2.0.0 returns segments with an `offset` property (seconds from video start), **not** a `start` property. The CONTEXT.md references `{text, start, duration}` but the actual library returns `{text, offset, duration, lang}`. Implementation must use `offset`. All downstream phases (Phase 3 context expansion, Phase 4 stitching) must align on `offset` as the source timestamp field.

The worker needs its own `worker/` subdirectory at the project root with its own `package.json`, a `tsconfig.worker.json` (or rely on Node 22's native `--experimental-strip-types`), and a Railway service pointing to that subdirectory. Prisma is consumed in the worker using the service-role DATABASE_URL (bypasses RLS), which requires that the Prisma migration adding `transcript` and `clipPlan` columns runs before the worker is deployed.

**Primary recommendation:** Scaffold `worker/` as a flat directory with its own `package.json`; use Node.js `--experimental-strip-types` (stable on v22.18+) to run TypeScript directly without a build step; use a `while (!shutdown)` async polling loop; deploy as a separate Railway service with root directory set to `worker/`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Transcript fetch from YouTube | Worker (Railway) | — | Network call to YouTube; must not run in Next.js serverless functions (cold-start latency, timeout risk) |
| Job pickup / polling | Worker (Railway) | — | Persistent process needed; Railway worker is always-on |
| Exact topic matching | Worker (Railway) | — | CPU-bound text processing; belongs in the worker alongside the transcript data |
| JSON column write (transcript, clipPlan) | Worker (Railway) | — | Worker is the only writer; Next.js only reads via Realtime |
| Job status reads in UI | Frontend Server (Next.js) | Browser | Existing Realtime subscription handles `PENDING → PROCESSING → DONE/FAILED` |
| Prisma migration (adding Json columns) | Local dev / CI | — | Migration is a one-time schema change; no runtime tier |
| SUB-03 (exact mode selection) | No new tier needed | — | Phase 2 has only one matching mode; no UI change required |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `youtube-transcript-plus` | 2.0.0 | Fetch timestamped YouTube captions (no API key) | Locked by D-01; free, unofficial caption endpoint, TypeScript types included |
| `@prisma/client` | 7.8.0 (already installed) | Write `transcript` and `clipPlan` JSON to Supabase | Already in project; worker reuses the same schema |
| `@prisma/adapter-pg` | 7.8.0 (already installed) | Prisma driver adapter for PostgreSQL | Required by Prisma 7 pg adapter pattern already in use |
| `pg` | 8.21.0 (already installed) | PostgreSQL driver for PrismaPg adapter | Already installed in project root |
| `dotenv` | 17.4.2 (already installed) | Load `.env.local` in worker | Already in devDependencies; worker needs to `dotenv/config` at startup |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `--experimental-strip-types` | built-in (Node 22.18+) | Run worker TypeScript without a build step | Preferred: avoids extra dependencies; stable in Node 22.19.0 |
| `tsx` [WARNING: flagged as suspicious — verify before using.] | 4.22.4 | Fallback TypeScript runner for the worker | Use only if native strip-types has issues; 58M weekly downloads but latest version published 2026-05-31 triggers seam SUS flag |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `worker/` directory at project root | Separate git repo | Separate repo is cleaner at scale but adds git/CI overhead for a single-developer MVP |
| Native `--strip-types` for worker TS | Compile to JS first (tsc) | Compiled output is simpler for production but adds a build step; Node 22 strip-types is good enough for this worker |
| Polling loop in worker | Supabase Realtime in worker | Realtime in a worker works but requires a persistent WebSocket and adds reconnect logic; polling is simpler per D-10 |

**Installation (run from project root once Prisma migration is done):**
```bash
npm install youtube-transcript-plus
```

**Version verification:** [VERIFIED: npm registry]
```
youtube-transcript-plus: 2.0.0 (published 2026-03-28)
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `youtube-transcript-plus` | npm | ~17 months | 16,561/wk | github.com/ericmmartin/youtube-transcript-plus | OK | Approved |
| `tsx` | npm | active (latest 2026-05-31) | 58,456,062/wk | github.com/privatenumber/tsx | SUS (too-new latest version) | Flagged — planner must add checkpoint:human-verify before installing |
| `ts-node` | npm | ~3 years | 46,155,137/wk | github.com/TypeStrong/ts-node | OK | Approved (fallback only) |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `tsx` — the seam flags it due to the latest version (4.22.4) being published 2026-05-31. The package itself is long-established (12k GitHub stars, 58M weekly downloads, github.com/privatenumber/tsx). Planner should prefer the Node 22 `--experimental-strip-types` approach to avoid the dependency entirely. If `tsx` is used, a `checkpoint:human-verify` task is required before installing it.

---

## Architecture Patterns

### System Architecture Diagram

```
[Browser]
    |
    | Supabase Realtime (existing Phase 1)
    |   postgres_changes on Job row (userId filter)
    v
[Next.js / Vercel]
    |
    | prisma.job.create() — status: PENDING (existing submit-job.ts)
    v
[Supabase PostgreSQL]
    ^                     ^
    | poll every 3-5s     | prisma.job.update()
    | findFirst PENDING   |   status: PROCESSING → DONE/FAILED
    |                     |   transcript: [...segments]
    |                     |   clipPlan: [...matches]
    v                     |
[Railway Worker Process]
    |
    | youtube-transcript-plus fetchTranscript(videoId)
    v
[YouTube internal caption endpoint]
```

**Data flow:**
1. Submit form → `submitJob` Server Action → creates `Job { status: PENDING }`
2. Worker polls → finds PENDING job → sets `PROCESSING`
3. Worker calls `fetchTranscript(videoId)` → gets `TranscriptSegment[]`
4. Worker normalizes + matches topic → builds `clipPlan[]`
5. Worker writes `transcript`, `clipPlan`, `status: DONE` (or `FAILED` + `errorMessage`)
6. Supabase Realtime fires → Browser UI updates automatically

### Recommended Project Structure

```
worker/                        # New: Railway worker service
├── package.json               # worker-specific deps + scripts
├── tsconfig.worker.json       # if needed (or use --strip-types)
├── .env.local                 # local dev env (gitignored)
├── src/
│   ├── index.ts               # entry point: polling loop
│   ├── prisma.ts              # worker Prisma client (service role URL)
│   ├── transcript.ts          # fetchTranscript wrapper + error mapping
│   └── matcher.ts             # normalize + exact match + clipPlan builder
src/
├── lib/
│   ├── youtube.ts             # existing — reuse extractYouTubeVideoId
│   ├── prisma.ts              # existing — Next.js Prisma client
│   └── supabase/              # existing
├── types/
│   └── job.ts                 # existing — extend Job interface with new fields
prisma/
└── schema.prisma              # add transcript Json? and clipPlan Json?
```

### Pattern 1: Polling Worker Loop (async while, graceful shutdown)

**What:** An async `while (!shutdown)` loop that awaits each tick, preventing overlapping concurrent executions that `setInterval` would allow.

**When to use:** Any always-on background worker that polls a database.

```typescript
// Source: Node.js process lifecycle best practice [ASSUMED]
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

let shutdown = false
let processingJob = false

process.on('SIGTERM', async () => {
  shutdown = true
  // Wait for in-flight job to finish before exit
  while (processingJob) await sleep(200)
  await prisma.$disconnect()
  process.exit(0)
})

async function main() {
  console.log('Worker started, polling for PENDING jobs...')
  while (!shutdown) {
    await processPendingJob()
    await sleep(4000)   // D-10: 3-5 second interval
  }
}

main().catch(err => {
  console.error('Worker fatal error:', err)
  process.exit(1)
})
```

**Why `while` over `setInterval`:** `setInterval` fires on wall-clock time regardless of whether the previous async tick has completed. If a job takes longer than the interval, two jobs run concurrently against the same row. The `while` loop waits for each tick to fully resolve before sleeping.

### Pattern 2: Claim-Then-Process (PENDING → PROCESSING atomic update)

**What:** Atomically claim a single PENDING job before processing it, preventing two worker instances from picking up the same job.

**When to use:** Any polling worker where multiple instances could run concurrently (e.g., Railway service with >1 replica).

```typescript
// Source: Prisma docs — updateMany with conditional status [ASSUMED]
async function claimJob() {
  // findFirst then update is NOT atomic — use updateMany with a where clause
  const result = await prisma.job.updateMany({
    where: { status: 'PENDING' },
    data: { status: 'PROCESSING' },
    // Prisma does not support LIMIT on updateMany in PostgreSQL — use a subquery approach
  })
  // NOTE: updateMany without LIMIT can claim multiple rows.
  // For v1 with a single worker replica, findFirst + update is sufficient.
  // See Pitfall 3 for the single-worker approach.
}
```

**V1 single-worker approach (sufficient for Phase 2):**

```typescript
// Source: project pattern [ASSUMED]
async function processPendingJob(): Promise<void> {
  const job = await prisma.job.findFirst({ where: { status: 'PENDING' } })
  if (!job) return

  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'PROCESSING' },
  })

  try {
    const videoId = extractYouTubeVideoId(job.youtubeUrl)
    if (!videoId) throw new Error('Invalid YouTube URL')

    const segments = await fetchTranscript(videoId, { retries: 2, retryDelay: 1000 })
    const clipPlan = buildClipPlan(segments, job.topic)

    await prisma.job.update({
      where: { id: job.id },
      data: {
        transcript: segments as unknown as Prisma.InputJsonValue,
        clipPlan: clipPlan as unknown as Prisma.InputJsonValue,
        status: 'DONE',
      },
    })
  } catch (err) {
    const errorMessage = mapTranscriptError(err)
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'FAILED', errorMessage },
    })
  }
}
```

### Pattern 3: Prisma JSON Column Write

**What:** Writing a typed array to a `Json?` Prisma field. Pass a plain JS array — Prisma serializes it automatically.

```typescript
// Source: Prisma docs — Working with JSON fields [CITED: prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields]
import { Prisma } from '../prisma/generated/prisma/client'

// Write: cast to InputJsonValue to satisfy Prisma 7 type checker
await prisma.job.update({
  where: { id: jobId },
  data: {
    transcript: segments as unknown as Prisma.InputJsonValue,
    clipPlan: matches as unknown as Prisma.InputJsonValue,
    status: 'DONE',
  },
})

// Read: cast from JsonValue
const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } })
const segments = job.transcript as TranscriptSegment[]
const plan = job.clipPlan as ClipMatch[]
```

### Pattern 4: Transcript Normalization + Adjacent Phrase Matching

**What:** Strip punctuation, normalize whitespace, lowercase. Check if the normalized topic appears as a contiguous substring in a segment's normalized text (D-06/D-07). Also check consecutive segment pairs for cross-boundary phrases (D-08).

```typescript
// Source: project pattern [ASSUMED]
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')       // normalize whitespace
    .trim()
}

function findMatches(segments: TranscriptSegment[], topic: string): ClipMatch[] {
  const normTopic = normalize(topic)
  const matches: ClipMatch[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const normSeg = normalize(seg.text)

    // Single-segment match (D-07)
    if (normSeg.includes(normTopic)) {
      matches.push({
        startMs: Math.round(seg.offset * 1000),
        endMs: Math.round((seg.offset + seg.duration) * 1000),
        text: seg.text,
        segmentIndices: [i],
      })
      continue
    }

    // Cross-boundary match with next segment (D-08)
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
        i++ // skip next segment — it's already consumed
      }
    }
  }

  return matches
}
```

### Pattern 5: youtube-transcript-plus Error Mapping

**What:** Translate library-specific errors into the project's plain-language error message pattern (D-03, Phase 1 D-11).

```typescript
// Source: youtube-transcript-plus README [CITED: github.com/ericmmartin/youtube-transcript-plus]
import {
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptInvalidVideoIdError,
} from 'youtube-transcript-plus'

function mapTranscriptError(err: unknown): string {
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

### Anti-Patterns to Avoid

- **Using `setInterval` for the polling loop:** Allows concurrent job processing if a tick takes longer than the interval. Use `while (!shutdown) { await ...; await sleep(N) }` instead.
- **Reading `segment.start` instead of `segment.offset`:** The library uses `offset` (seconds) not `start`. Reading a non-existent property returns `undefined`, silently producing `NaN` timestamps.
- **Setting `status = 'PROCESSING'` after transcript fetch:** The claim must happen before any I/O. If the worker crashes after the fetch but before the status update, the job stays PENDING and gets retried correctly — which is the desired behavior.
- **Storing transcript with `Prisma.JsonNull`:** Only needed when explicitly storing JSON null. Pass the segments array directly and Prisma serializes it.
- **Importing from `@/` paths in the worker:** The `@/` alias is configured in Next.js tsconfig.json and is not available in the worker. Worker uses relative imports or its own path aliases.
- **Running the worker inside Next.js API routes:** YouTube transcript fetch can take 1–5 seconds. Vercel serverless functions have a 10-second timeout (free tier). The worker must run on Railway.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube caption fetch | Custom HTTP scraper of YouTube pages | `youtube-transcript-plus` | YouTube's caption endpoint is undocumented and changes; the library tracks format changes |
| Retry on 429 | Custom retry loop around fetch | `youtube-transcript-plus` config: `{ retries: 2, retryDelay: 1000 }` | The library implements exponential backoff on 429 and 5xx errors natively |
| TypeScript execution in worker | Custom ts-to-js compiler | Node 22 `--experimental-strip-types` | Available on Node 22.18+ (project uses 22.19); zero extra dependency |
| DB connection for worker | Raw `pg` client with manual SQL | Prisma Client with `PrismaPg` adapter | Prisma already handles connection pooling, type safety, and migration alignment |

**Key insight:** The YouTube caption endpoint format has historically changed without notice. `youtube-transcript-plus` has been updated through 10 versions since Jan 2025 specifically to track these format changes. Hand-rolling this fetch is high-maintenance.

---

## Common Pitfalls

### Pitfall 1: `offset` vs `start` — Incorrect Field Name

**What goes wrong:** Code reads `segment.start` instead of `segment.offset`, producing `NaN` millisecond values silently. Clip plan timestamps are garbage; Phase 3 expansion fails.

**Why it happens:** The CONTEXT.md describes the format as `{text, start, duration}` — but the actual library returns `{text, offset, duration, lang}`. The field was renamed at some point in the library's history.

**How to avoid:** Always import the `TranscriptSegment` type from `youtube-transcript-plus` and let TypeScript flag unknown properties. Add a unit test that asserts `segment.offset` is a number.

**Warning signs:** Clip plan entries have `startMs: NaN` or `startMs: 0` for non-zero timestamps.

### Pitfall 2: ESM Package in CommonJS Worker Context

**What goes wrong:** `youtube-transcript-plus` v2.0.0 is `"type": "module"` (ESM). A worker with `"type": "commonjs"` (or no `type` field) using `require()` will throw `Error [ERR_REQUIRE_ESM]` at runtime.

**Why it happens:** Node.js enforces ESM/CJS boundaries.

**How to avoid:** Set `"type": "module"` in `worker/package.json` and use `import` syntax throughout the worker. Alternatively, the package also ships a CJS build (`dist/youtube-transcript-plus.cjs`) — but using ESM is cleaner. With Node 22 `--experimental-strip-types`, `.ts` files are treated as ESM when `"type": "module"` is set.

**Warning signs:** `Error [ERR_REQUIRE_ESM]` at startup.

### Pitfall 3: Race Condition on PENDING Job Claim (multi-replica)

**What goes wrong:** Two worker instances both `findFirst({ where: { status: 'PENDING' } })` and get the same job. Both set it to `PROCESSING`. Two transcript fetches run; last write wins. Phase 1 has only one worker, so this is low-risk now but must be designed for.

**Why it happens:** `findFirst` + `update` is not atomic.

**How to avoid:** For Phase 2 (single worker replica), `findFirst` + `update` is sufficient. For future multi-replica, use a raw SQL `UPDATE jobs SET status='PROCESSING' WHERE id = (SELECT id FROM jobs WHERE status='PENDING' LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *` via `prisma.$queryRaw`.

**Warning signs:** Two PROCESSING records for the same job; duplicate transcript writes.

### Pitfall 4: Prisma Client Path in Worker

**What goes wrong:** Worker imports `from '../../prisma/generated/prisma/client'` using a relative path that resolves differently depending on the `worker/` CWD. The generated client is gitignored, so Railway builds will fail if `prisma generate` is not run.

**Why it happens:** Prisma generated output is not committed to git (`.gitignore` includes `prisma/generated/`).

**How to avoid:** Add `prisma generate` to `worker/package.json` `build` script or Railway start command. Example Railway start command: `npx prisma generate && node --experimental-strip-types src/index.ts`.

**Warning signs:** `Cannot find module '../../prisma/generated/prisma/client'` at Railway build time.

### Pitfall 5: RLS Blocking Worker Writes

**What goes wrong:** Worker uses `DATABASE_URL` (Supabase transaction pooler, `anon` role) and cannot update Job rows because RLS `WITH CHECK` policies require `userId = auth.uid()`. The worker has no auth session, so writes are rejected silently (0 rows updated).

**Why it happens:** The Next.js Prisma client uses the pooler URL with the `anon` role, which is subject to RLS.

**How to avoid:** Worker must use the `service_role` database URL — either Supabase's direct connection string authenticated as `postgres` (bypasses RLS), or a dedicated `DATABASE_URL` env var that uses the service role. In Supabase: Settings → Database → Connection string, use the `postgres` role. Set `WORKER_DATABASE_URL` in Railway env vars (never expose in Next.js where it could reach the browser).

**Warning signs:** `prisma.job.update()` succeeds (no error thrown) but job status does not change in Supabase.

### Pitfall 6: Videos Without Auto-Generated Captions

**What goes wrong:** `fetchTranscript()` throws `YoutubeTranscriptNotAvailableError` for videos that have no captions at all — including many live-stream recordings and unlisted lectures. The error must be caught and translated to FAILED state.

**Why it happens:** YouTube only provides transcripts for videos with manual or auto-generated captions. Academic lecture uploads often have neither.

**How to avoid:** Catch `YoutubeTranscriptNotAvailableError` and `YoutubeTranscriptDisabledError` explicitly. Use `mapTranscriptError()` to produce a user-facing message. Do not re-throw.

**Warning signs:** Unhandled promise rejection; job stuck in PROCESSING.

---

## ClipMatch Type (Claude's Discretion)

The `clipPlan` JSON column stores an array of `ClipMatch` objects. Recommended shape (must include timestamps for Phase 3 context expansion):

```typescript
// Recommended for worker/src/types.ts
export interface ClipMatch {
  startMs: number          // segment.offset * 1000 (rounded)
  endMs: number            // (segment.offset + segment.duration) * 1000 (rounded)
  text: string             // raw transcript text of matched segment(s)
  segmentIndices: number[] // indices into the raw transcript array (for Phase 3 lookups)
}

export interface TranscriptSegment {
  text: string
  offset: number     // seconds — NOT 'start'
  duration: number   // seconds
  lang: string
}
```

Phase 3 will extend each `ClipMatch` with a context window (`contextStartMs`, `contextEndMs`) without changing the base fields.

---

## Runtime State Inventory

> This is not a rename/refactor/migration phase. Omit — N/A.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Worker runtime | ✓ | 22.19.0 | — |
| npm | Package install | ✓ | 11.16.0 | — |
| `youtube-transcript-plus` | TRN-01/TRN-02 | ✗ (not yet installed) | 2.0.0 on registry | — |
| Railway account | Worker deployment | ✓ (assumed from Phase 1 D-13) | — | — |
| Supabase service role URL | Worker DB writes | ✓ (Supabase project exists) | — | — |
| `prisma generate` on Railway | Worker Prisma client | Must add to build step | — | Without this, Railway deploy fails |
| Node 22 `--strip-types` | Worker TS execution | ✓ | stable in 22.18+ | `ts-node` or compile step |

**Missing dependencies with no fallback:**
- `youtube-transcript-plus` must be installed before worker implementation begins.
- `worker/package.json` and Railway service must be created in Phase 2.

**Missing dependencies with fallback:**
- `tsx` (SUS-flagged): Node 22 `--experimental-strip-types` is the preferred alternative and requires no extra install.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.mts` (project root) |
| Quick run command | `npm test` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRN-01 | `fetchTranscript()` returns segments with `offset` field | unit (mock library) | `npm run test:run -- --reporter=verbose` | ❌ Wave 0 |
| TRN-02 | Mapping `YoutubeTranscriptNotAvailableError` → FAILED job | unit | `npm run test:run` | ❌ Wave 0 |
| TRN-03 | `normalize()` strips punctuation, lowercases, collapses whitespace | unit | `npm run test:run` | ❌ Wave 0 |
| MAT-01 | `findMatches()` finds exact substring in single segment | unit | `npm run test:run` | ❌ Wave 0 |
| MAT-01 | `findMatches()` finds phrase split across two segments (D-08) | unit | `npm run test:run` | ❌ Wave 0 |
| MAT-01 | `findMatches()` returns empty array when topic not found | unit | `npm run test:run` | ❌ Wave 0 |
| CLP-01 | `ClipMatch` contains `startMs`, `endMs`, `segmentIndices` | unit | `npm run test:run` | ❌ Wave 0 |

### Worker Tests

Worker test files live in `worker/src/__tests__/` and run separately from the Next.js Vitest suite (worker has its own `vitest.config.ts`). Worker test setup mirrors the root setup: Vitest + `@testing-library/jest-dom` not needed (no React), just plain Vitest.

### Sampling Rate

- **Per task commit:** `npm run test:run` (full Vitest suite, ~5s)
- **Per wave merge:** `npm run test:run` (all tests green)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `worker/src/__tests__/transcript.test.ts` — covers TRN-01, TRN-02 (mock `youtube-transcript-plus`)
- [ ] `worker/src/__tests__/matcher.test.ts` — covers TRN-03, MAT-01, CLP-01
- [ ] `worker/vitest.config.ts` — Vitest config for the worker package
- [ ] `worker/package.json` — worker package with `test` script pointing to worker Vitest

---

## Security Domain

Security enforcement is enabled (`security_enforcement: true`). ASVS Level 1 applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Worker uses service role key (machine identity, not user auth) |
| V3 Session Management | No | Worker is a background process; no user sessions |
| V4 Access Control | Yes | Service role key must never be committed to git or exposed in Next.js env vars; Railway env vars only |
| V5 Input Validation | Yes | Video ID extracted with existing `extractYouTubeVideoId()` before passing to library |
| V6 Cryptography | No | No cryptographic operations in Phase 2 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service role key leaked to browser | Information Disclosure | Never set `WORKER_DATABASE_URL` in Next.js env (only Railway service env vars); follows Supabase security docs |
| Malformed video IDs passed to YouTube API | Tampering | Use `extractYouTubeVideoId()` (already tested) before calling `fetchTranscript()`; library also throws `YoutubeTranscriptInvalidVideoIdError` |
| Job row poisoning (fake PENDING jobs) | Elevation of Privilege | Worker uses service role key which bypasses RLS — but it only reads/writes its own job rows by ID; no user can inject arbitrary data into the worker's processing path |
| Infinite PROCESSING jobs (worker crash mid-job) | Denial of Service | Phase 2 worker is single-replica; if it crashes, Railway restarts it. The job stays PROCESSING until manual reset. Implement a `stuck-job` timeout in Phase 2 (or defer to Phase 4). |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `youtube-transcript` (original package) | `youtube-transcript-plus` (fork/rewrite) | Ongoing; youtube-transcript-plus v2.0.0 published 2026-03 | Better TypeScript types, retry support, caching API |
| `ts-node` for TypeScript workers | Node.js native `--experimental-strip-types` | Stable in Node 22.18 (2025) | No extra dependency; simpler worker setup |

**Deprecated/outdated:**
- `youtube-transcript` (the original npm package): Appears to have maintenance gaps; `youtube-transcript-plus` is the actively maintained successor with 10 versions since Jan 2025.
- `--experimental-strip-types` flag name: The `experimental-` prefix was removed in Node 24 but is still required on Node 22. Use the flag explicitly.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TranscriptSegment.offset` is in seconds (not milliseconds) | Standard Stack, Code Examples | Clip timestamps would be 1000x too small; all Phase 3 context windows would be wrong |
| A2 | Node 22 `--experimental-strip-types` works with `"type": "module"` ESM worker | Standard Stack | Worker may require a compile step or `tsx` fallback |
| A3 | Railway free tier supports a persistent polling worker (not serverless) | Architecture | Worker cannot poll if Railway puts process to sleep; would need a paid plan or different architecture |
| A4 | Supabase service role Postgres connection string bypasses RLS in Prisma 7 + PrismaPg adapter | Common Pitfalls | Worker writes would be silently blocked; no jobs would ever complete |
| A5 | Single-worker polling (no concurrent replicas) is acceptable for MVP | Architecture Patterns | If Railway auto-scales, race condition on job claim becomes real |
| A6 | `worker/` as a subdirectory of the project root is supported by Railway's root directory setting | Architecture Patterns | If not, worker must be a separate repository |

---

## Open Questions

1. **Supabase `DIRECT_URL` for worker — session-mode vs direct mode**
   - What we know: The root `prisma.config.ts` uses `DIRECT_URL` pointing to the session-mode pooler (`aws-0-*.pooler.supabase.com:5432`) because IPv6-only direct URLs don't work from some environments (STATE.md blocker note).
   - What's unclear: Does the Railway worker need the same session-mode pooler URL, or can it use the direct Supabase connection? The worker needs `service_role` auth, not `anon`.
   - Recommendation: In Railway env vars, set `DATABASE_URL` to the Supabase `postgres` role transaction pooler URL (e.g., `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`). This uses the `postgres` superuser (bypasses RLS) and avoids IPv6 issues.

2. **No-match behavior: DONE with empty clip plan vs FAILED**
   - What we know: D-03 only defines FAILED for "no transcript available". No decision covers "transcript found but topic not mentioned."
   - What's unclear: Should a video with a valid transcript but zero matches be DONE (with empty clipPlan) or FAILED (with "Topic not found" error)?
   - Recommendation: Set to DONE with empty clipPlan. The Phase 3/results page can show "No mentions found" — this is a valid outcome, not a system failure.

---

## Sources

### Primary (MEDIUM confidence)
- [youtube-transcript-plus README](https://raw.githubusercontent.com/ericmmartin/youtube-transcript-plus/main/README.md) — fetchTranscript API, TranscriptSegment shape, error classes, TranscriptConfig
- [youtube-transcript-plus source (index.ts)](https://github.com/ericmmartin/youtube-transcript-plus/blob/main/src/index.ts) — confirmed `offset` field name
- [Prisma JSON fields docs](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields) — schema definition, create/update patterns, Prisma.JsonNull vs Prisma.DbNull

### Secondary (LOW confidence)
- npm registry — `npm view youtube-transcript-plus --json`: version 2.0.0, published 2026-03-28, 16,561 weekly downloads, no postinstall script [VERIFIED: npm registry]
- Railway Help Station — separate service per worker, root directory setting for monorepo [LOW: websearch]
- Node.js TypeScript docs — `--experimental-strip-types` stable in v22.18+ [LOW: websearch]

### Tertiary (LOW confidence)
- Node.js process lifecycle best practices — SIGTERM graceful shutdown pattern [ASSUMED: training knowledge]

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — `youtube-transcript-plus` API verified from official GitHub README; Prisma JSON field pattern verified from official Prisma docs
- Architecture: MEDIUM — Railway deployment pattern from Railway help docs; worker polling pattern from Node.js best practices
- Pitfalls: MEDIUM — `offset` vs `start` verified from library source code; RLS bypass from Supabase docs

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 (30 days; youtube-transcript-plus may update if YouTube changes caption format)
