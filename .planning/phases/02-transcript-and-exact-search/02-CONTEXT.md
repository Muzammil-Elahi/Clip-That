# Phase 2: Transcript and Exact Search - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers YouTube transcript retrieval and exact topic matching. This includes: fetching timestamped transcript data for a submitted YouTube video, detecting when no usable transcript exists, normalizing transcript text for matching, finding exact topic mentions using phrase-level matching, and creating an initial clip plan stored on the Job record. It also scaffolds the Railway worker process that runs all of this. Context-window expansion, segment merging, and the stitched transcript UI are out of scope (Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Transcript Retrieval
- **D-01:** Transcript library — **`youtube-transcript-plus`** npm package. Free, no API key needed, uses YouTube's internal caption endpoint. No Railway binary installation required.
- **D-02:** Transcript format — Keep the **raw `{text, start, duration}` array** as returned by the library. No conversion step in Phase 2; downstream phases derive what they need.
- **D-03:** No-transcript handling — Set job status to **`FAILED`** with a specific user-facing error message (e.g., "This video doesn't have a usable transcript."). Uses the existing Phase 1 failure-state UI. No new `UNSUPPORTED` status needed.

### Data Model
- **D-04:** Transcript storage — **JSON column on the `Job` table** (`transcript Json?` in Prisma schema). Simple, co-located, no extra tables or file I/O. Adequate for typical video transcripts (120KB–480KB of JSON for 30–90 min videos).
- **D-05:** Clip plan storage — **JSON column on the `Job` table** (`clipPlan Json?` in Prisma schema). Stores the list of matched transcript spans (with source timestamps) after exact matching.

### Exact Matching
- **D-06:** Normalization — **Strip punctuation, normalize whitespace, lowercase** both the topic and each transcript segment before comparing. Handles caption artifacts (e.g., punctuation mid-phrase, extra spaces).
- **D-07:** Multi-word phrases — **Adjacent phrase matching**. The topic words must appear in order and adjacent in the normalized text. "Machine learning" matches "machine learning is" but not "machine that is learning".
- **D-08:** Cross-segment check — **Also check consecutive segment pairs** by concatenating adjacent segments during matching. Handles phrases that split across caption boundaries (e.g., "machine" ends one segment, "learning" starts the next).

### Worker
- **D-09:** Worker location — **Scaffold the Railway worker process in Phase 2.** This is the natural entry point per the D-02 architecture decision. The worker handles all transcript work so Phase 3–4 don't need to migrate anything.
- **D-10:** Job pickup — **Polling loop.** Worker queries Supabase for `PENDING` jobs on a short interval (e.g., every 3–5 seconds). Simple, reliable, no persistent WebSocket required.

### Claude's Discretion
- Polling interval for the worker loop (3–5 seconds is a reasonable default).
- Exact Prisma field names for the new JSON columns (`transcript`, `clipPlan` or similar).
- ClipPlan JSON shape (array of `{startMs, endMs, text, segmentIndices}` or similar — must include source timestamps for Phase 3).
- Worker project structure (monorepo subfolder vs. separate `worker/` directory at project root).
- Error handling and retry behavior within the worker for transient YouTube API failures.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Core value, constraints, key decisions (YouTube-first, anonymous, low-cost, free tiers preferred)
- `.planning/REQUIREMENTS.md` — Phase 2 covers SUB-03, TRN-01, TRN-02, TRN-03, MAT-01, CLP-01
- `.planning/ROADMAP.md` — Phase 2 goal and plan breakdown (02-01: retrieval + unsupported-video; 02-02: normalization, matching, clip plan)

### Prior Phase Context
- `.planning/phases/01-anonymous-job-shell/01-CONTEXT.md` — Architecture decisions that Phase 2 builds on (D-01–D-15), especially D-02 (worker on Railway), D-03/D-04 (Supabase + Prisma), D-11 (plain-language errors), D-15 (free tiers)

### Existing Code
- `src/lib/youtube.ts` — `extractYouTubeVideoId()` utility; reuse for video ID extraction before transcript fetch
- `src/types/job.ts` — `Job` interface and `JobStatus` enum; extend with new fields if needed
- `prisma/schema.prisma` — Current `Job` model; Phase 2 adds `transcript Json?` and `clipPlan Json?` columns

No external specs or ADRs beyond the above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/youtube.ts` → `extractYouTubeVideoId(url)` — Use this in the worker to get the video ID before calling `youtube-transcript-plus`. Already tested.
- `src/types/job.ts` → `JobStatus` enum — Worker imports this (or the Prisma-generated enum) to set `PROCESSING`, `DONE`, `FAILED` on the job row.
- `src/actions/submit-job.ts` → Creates `Job` with `status: 'PENDING'` — This is the trigger the worker polls for.

### Established Patterns
- Prisma client at `prisma/generated/prisma` (gitignored, generated from `prisma/schema.prisma`)
- `dotenv` loaded via `prisma.config.ts` for CLI; worker needs its own env loading
- Supabase client pattern: `createClient()` from `@/lib/supabase/server` for server-side auth; worker will use `@supabase/supabase-js` directly with service role key
- Error handling pattern: return plain-language strings, set `errorMessage` on Job for FAILED state

### Integration Points
- Prisma `Job` model — Phase 2 adds `transcript Json?` and `clipPlan Json?`; migration required before worker can write these fields
- Worker ↔ Supabase — Worker reads `Job` rows (Prisma), writes `transcript`, `clipPlan`, and `status` back to Supabase; uses service role key (bypasses RLS for worker writes)
- Next.js status page — Already subscribed to Job row changes via Supabase Realtime; job status transitions (`PENDING → PROCESSING → DONE/FAILED`) will flow through the existing subscription

</code_context>

<specifics>
## Specific Ideas

- The worker polls for `PENDING` jobs, claims one (sets it to `PROCESSING`), fetches the transcript, runs matching, writes `transcript` and `clipPlan` JSON columns, then sets status to `DONE` or `FAILED`. The existing status page subscription picks up each status change automatically.
- The `clipPlan` JSON should preserve source timestamps (start/end offsets from the transcript) since Phase 3 needs them for context-window expansion.
- Checking consecutive segment pairs for phrase splits is important because YouTube auto-captions frequently split natural phrases at word boundaries mid-phrase.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-transcript-and-exact-search*
*Context gathered: 2026-06-14*
