---
phase: 02-transcript-and-exact-search
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - prisma/migrations/20260618000004_add_transcript_clip_plan/migration.sql
  - prisma/schema.prisma
  - src/types/job.ts
  - worker/package.json
  - worker/vitest.config.ts
  - worker/src/__tests__/matcher.test.ts
  - worker/src/__tests__/transcript.test.ts
  - worker/src/index.ts
  - worker/src/matcher.ts
  - worker/src/prisma.ts
  - worker/src/transcript.ts
  - worker/src/types.ts
  - worker/src/youtube.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase introduces the worker process that fetches YouTube transcripts, performs exact-phrase matching, and writes results back to the database. The implementation is generally clean and the pure-function matcher is well-structured. However, three blockers require attention before this code ships: the SIGTERM handler can loop forever on a stuck job (process never exits), the `mapTranscriptError` function silently swallows two error classes from the library that are available at runtime (`YoutubeTranscriptNotAvailableLanguageError`, `YoutubeTranscriptInvalidLangError`), and the non-null assertion on `WORKER_DATABASE_URL` will crash the process at startup with a misleading message when the env var is missing. Several warnings cover correctness issues in the matcher (cross-boundary skip advances past unmatched segments), missing error handling on the Prisma `$disconnect` call, duplicate type definitions drifting out of sync, and a SIGINT gap.

---

## Critical Issues

### CR-01: SIGTERM handler busy-loops forever if job hangs — process never exits

**File:** `worker/src/index.ts:15-21`
**Issue:** The SIGTERM handler sets `shutdown = true`, then spins in `while (processingJob) await sleep(200)` indefinitely. If the in-flight job is stuck on a network call (e.g., `fetchTranscript` hangs because YouTube never responds), `processingJob` never becomes `false` and the process never reaches `process.exit(0)`. Container orchestrators (Kubernetes, Docker Compose, Render) send SIGKILL after their grace period — but the `prisma.$disconnect()` at line 19 is never called, leaving the DB connection dirty. More concretely, the process cannot be shut down cleanly at all without an external SIGKILL.

**Fix:** Add a deadline to the wait loop, then force exit:
```typescript
process.on('SIGTERM', async () => {
  shutdown = true
  const deadline = Date.now() + 10_000 // 10 s grace period
  while (processingJob && Date.now() < deadline) await sleep(200)
  try {
    await prisma.$disconnect()
  } catch {
    // best-effort
  }
  process.exit(processingJob ? 1 : 0) // non-zero exit signals unclean shutdown
})
```

---

### CR-02: `mapTranscriptError` does not handle `YoutubeTranscriptNotAvailableLanguageError` or `YoutubeTranscriptInvalidLangError` — both fall through to a generic message that is misleading

**File:** `worker/src/transcript.ts:22-39`
**Issue:** The `youtube-transcript-plus` library exports six error classes. `mapTranscriptError` handles five of them but omits `YoutubeTranscriptNotAvailableLanguageError` (thrown when the requested language code is not available for a video) and `YoutubeTranscriptInvalidLangError` (thrown when the `lang` option is an invalid BCP 47 code). Although `fetchTranscript` is currently called without a `lang` option, the library may still throw `YoutubeTranscriptNotAvailableLanguageError` when auto-detection falls back and the result set is empty. Both errors reach the `catch` in `index.ts` and produce the fallback `"Failed to retrieve transcript. Please try again."` — which stores `FAILED` on a job that the user cannot retry meaningfully (the video simply has no English captions).

**Fix:**
```typescript
import {
  // existing imports …
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptInvalidLangError,
} from 'youtube-transcript-plus'

// Inside mapTranscriptError, before the final return:
if (
  err instanceof YoutubeTranscriptNotAvailableLanguageError ||
  err instanceof YoutubeTranscriptInvalidLangError
) {
  return "This video doesn't have a usable transcript."
}
```

---

### CR-03: Non-null assertion on `WORKER_DATABASE_URL` crashes the process at startup with no actionable error message

**File:** `worker/src/prisma.ts:10-11`
**Issue:** `process.env.WORKER_DATABASE_URL!` uses the TypeScript non-null assertion, which at runtime is a no-op. When the env var is absent the string `undefined` is passed as the `connectionString`, causing `PrismaPg` to either throw an opaque constructor error or silently accept the string and only fail on first query with a low-level pg connection error. Neither error surface points the operator to the missing variable. This is a startup misconfiguration that cannot be observed until the first job is processed.

**Fix:** Guard at module load time with an explicit, actionable message:
```typescript
const connectionString = process.env.WORKER_DATABASE_URL
if (!connectionString) {
  console.error('FATAL: WORKER_DATABASE_URL environment variable is not set.')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString })
export const prisma = new PrismaClient({ adapter })
```

---

## Warnings

### WR-01: Cross-boundary match advances `i` past the next segment even when that segment could contain its own single-segment match

**File:** `worker/src/matcher.ts:56-58`
**Issue:** When a cross-boundary match is found between `segments[i]` and `segments[i+1]`, the loop does `i++` (line 57) to skip `segments[i+1]`. This is correct if both segments are fully consumed by the match — but the match could start in the middle of `segments[i]` and span only a prefix of `segments[i+1]`. Because the cross-boundary concatenation is `seg.text + ' ' + nextSeg.text` (the full text of both segments), a match found in the combined string does not guarantee that `nextSeg` is fully consumed. If `nextSeg` itself independently contains the topic, it is skipped and that match is lost.

Example: topic = `"deep learning"`, segments = `[{text:"about deep"}, {text:"learning deep learning"}]`. The cross-boundary check fires, `i++` skips segment 1 entirely, and the standalone `"deep learning"` at the end of segment 1 is never reported.

**Fix:** After recording the cross-boundary match, do NOT increment `i` unconditionally. Instead, check whether `nextSeg` also contains a single-segment match and, if so, record it too before incrementing. Alternatively, document the known limitation clearly and decide whether the product behaviour (first-match wins) is acceptable.

---

### WR-02: No SIGINT handler — Ctrl-C during development leaves DB connections open

**File:** `worker/src/index.ts:15-21`
**Issue:** Only `SIGTERM` is handled. During local development `Ctrl-C` sends `SIGINT`, which terminates Node immediately, skipping `prisma.$disconnect()`. On long-lived dev machines this can exhaust the pg connection pool limit quickly (default Supabase is 15–25 direct connections).

**Fix:**
```typescript
async function gracefulShutdown() {
  shutdown = true
  const deadline = Date.now() + 10_000
  while (processingJob && Date.now() < deadline) await sleep(200)
  try { await prisma.$disconnect() } catch {}
  process.exit(0)
}
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT',  gracefulShutdown)
```

---

### WR-03: `prisma.$disconnect()` in SIGTERM handler is not awaited inside a try/catch — a rejection crashes the handler silently

**File:** `worker/src/index.ts:19`
**Issue:** `await prisma.$disconnect()` is inside an async SIGTERM handler, but no try/catch wraps it. If the DB connection is already broken (e.g., the network dropped), `$disconnect()` rejects, the async handler throws an unhandled rejection, and Node.js may terminate with a non-zero exit code and print a confusing stack trace rather than a clean exit. This is separate from CR-01 (the timeout issue).

**Fix:** Wrap in try/catch (shown in CR-01 fix above).

---

### WR-04: Duplicate type definitions in `worker/src/types.ts` and `src/types/job.ts` will diverge silently

**File:** `worker/src/types.ts:1-25`, `src/types/job.ts:16-32`
**Issue:** `TranscriptSegment` and `ClipMatch` are defined identically in two files. The comment says "Mirror src/types/job.ts — keep in sync" but there is no mechanism to enforce sync. A future change to one copy (e.g., adding an `endOffset` field) will not update the other, and TypeScript will not catch the divergence because the two files are in separate compilation units (the worker does not import from `src/`). The `as unknown as Prisma.InputJsonValue` casts in `index.ts` mean runtime data from the worker can have a different shape than what the frontend's `Job.transcript: TranscriptSegment[]` expects.

**Fix:** Extract shared types into a small `packages/types` package (or a plain `.ts` file symlinked into both roots) and import from a single source of truth. At minimum, add a build-time `tsc --noEmit` check that imports from both locations and compares shapes with `satisfies`.

---

### WR-05: `processPendingJob` has no race-condition guard — two concurrent invocations can process the same job

**File:** `worker/src/index.ts:23-57`
**Issue:** The worker is single-loop (`while (!shutdown)`), so concurrent invocations from the same process are not possible today. However, `processPendingJob` does `findFirst` then a separate `update` to mark the job `PROCESSING` — these are two separate queries with no transaction or `SELECT FOR UPDATE` lock. If a second worker instance is started (e.g., for redundancy), both instances can pick up the same `PENDING` job simultaneously, resulting in duplicate transcript fetches and a second write overwriting the first.

**Fix:** Atomically claim the job in a single `UPDATE ... WHERE status = 'PENDING' RETURNING *` (raw SQL via `prisma.$queryRaw`) or use a Prisma interactive transaction with a `FOR UPDATE SKIP LOCKED` query. Document the single-instance constraint explicitly if multi-instance is not a goal for this phase.

---

## Info

### IN-01: `fetchTranscript` return type is inferred, not explicit — creates a fragile implicit contract

**File:** `worker/src/transcript.ts:14-16`
**Issue:** `fetchTranscript` has no explicit return type annotation. It returns whatever `YoutubeTranscript.fetchTranscript` returns (`Promise<TranscriptSegment[]>`), but this is only inferred. If the library changes its return type signature (e.g., when `videoDetails` is enabled the return type becomes `TranscriptSegment[] | TranscriptResult`), TypeScript will silently widen the inferred type and the `buildClipPlan(segments, ...)` call in `index.ts` may receive a wrong type without a compile error.

**Fix:**
```typescript
import type { TranscriptSegment } from 'youtube-transcript-plus'

export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  return YoutubeTranscript.fetchTranscript(videoId, { retries: 2, retryDelay: 1000 })
}
```

---

### IN-02: `matcher.test.ts` "multiple matches" test comment is wrong about which segments match

**File:** `worker/src/__tests__/matcher.test.ts:65-77`
**Issue:** The comment at line 65-67 says: "Segment 1 doesn't match single, but cross-boundary [1,2] contains 'neural networks' — skip segment 2 / Result: two matches at [0] and [1,2]". But segment 1 is `"some other content"` and segment 2 is `"neural networks again"`. The cross-boundary of segments 1+2 is `"some other content neural networks again"`, which does contain `"neural networks"` — so the comment is accidentally correct about the indices being `[1,2]`, but the reasoning is misleading (segment 2 alone would match; it only falls into the cross-boundary path because segment 1 is processed first and the single-segment check fails, then the cross-boundary check passes). This is a test comment quality issue, not a test logic error — the assertion itself is correct.

**Fix:** Update the comment to accurately describe why `[1,2]` is the result rather than `[2]`: segment 1 fails its single-segment check, the cross-boundary combined string of `[1,2]` matches, so both indices are recorded and segment 2 is skipped.

---

### IN-03: `worker/package.json` `build` script runs `prisma generate` but no `start` script compiles TypeScript first — `--experimental-strip-types` may silently mishandle decorators or complex generics at runtime

**File:** `worker/package.json:6-9`
**Issue:** The `start` script uses `node --experimental-strip-types src/index.ts`, which type-strips at runtime without type-checking. This is a known limitation of the flag: it does not run `tsc`, so type errors in the worker are only caught if `tsc` is explicitly run separately. There is no `typecheck` or `lint` script in the worker's `package.json`, meaning CI could ship type-broken worker code. The main `package.json` (if it has a typecheck script) does not cover the `worker/` subtree.

**Fix:** Add a `"typecheck": "tsc --noEmit"` script to `worker/package.json` and ensure it is run in CI. Alternatively use `tsx` or a build step that runs both `tsc` and then `node dist/index.js`.

---

_Reviewed: 2026-06-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
