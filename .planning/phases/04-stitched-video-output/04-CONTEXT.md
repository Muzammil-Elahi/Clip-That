# Phase 4: Stitched Video Output - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 takes the `mergedWindows` produced by Phase 3 (arrays of context-expanded segments, each with `sourceStartMs`/`sourceEndMs` from `StitchedTranscriptEntry`) and produces an actual playable video file. The Railway worker downloads the YouTube source video, extracts the planned segments with FFmpeg, stitches them into one continuous `.mp4`, uploads it to Supabase Storage, stores a signed URL on the Job record, and the browser plays it in the Video tab. Temporary artifact expiration (VID-04, JOB-03) is also in scope: the worker's polling loop runs a cleanup pass to delete expired files and null the stored URL. Study notes, PDF generation, and semantic matching are out of scope (Phases 5–6).

</domain>

<decisions>
## Implementation Decisions

### Cost Constraint
- **D-01:** Free tiers only — all services and tools used in Phase 4 must be free or on a free tier plan. No paid infrastructure (no AWS S3, no paid Cloudflare R2, no paid video CDN). This is a hard constraint for Phase 4 and all subsequent phases.

### YouTube Video Download
- **D-02:** YouTube video retrieval library — **`@distube/ytdl-core`** (active Node.js fork of ytdl-core). Node-only install, no Railway system package or binary configuration required. Same install pattern as `youtube-transcript-plus` already in the worker. If YouTube anti-bot measures degrade reliability later, `yt-dlp` is the upgrade path.

### FFmpeg Integration
- **D-03:** FFmpeg binary — **Claude's discretion** (e.g., `ffmpeg-static` npm package which bundles a pre-built FFmpeg binary, or `@ffmpeg-installer/ffmpeg`). Must work on Railway without manual system package setup. `fluent-ffmpeg` wrapper or direct `child_process` spawn is Claude's discretion.

### Artifact Storage
- **D-04:** Storage backend — **Supabase Storage** (already in the stack, free tier: 1GB storage / 2GB bandwidth, sufficient for MVP). The worker uploads the stitched `.mp4` to a Supabase Storage bucket, then stores the resulting signed URL on the Job record (`videoUrl String?`). The browser plays the video directly from the signed URL.
- **D-05:** Prisma schema additions — Add `videoUrl String?` (the Supabase Storage signed URL) and `videoExpiresAt DateTime?` (set to now + retention window, e.g., 24h) to the Job model. Requires a Prisma migration.

### Artifact Expiration
- **D-06:** Expiration mechanism — **Worker cleanup pass on each polling tick**. The worker's existing polling loop already runs every 4 seconds. On each tick, before or after checking for PENDING jobs, query for jobs where `videoExpiresAt` is in the past and `videoUrl` is non-null, delete their Supabase Storage files, and null `videoUrl`. No separate cron process or infrastructure needed.
- **D-07:** Retention window — **Claude's discretion** (24h is a reasonable default; use a configurable constant in the worker). The window starts at job completion.

### Video Tab UI
- **D-08:** Video player — **HTML5 `<video>` with native browser controls** (`<video controls src={videoUrl} className="w-full rounded-md" />`). No new player library dependencies. The `videoUrl` field flows to `status-view.tsx` via Supabase Realtime the same way `stitchedTranscript` already does — add `videoUrl` to the Realtime payload and the existing polling fallback.
- **D-09:** Video tab states — The Video tab shows: "Working on it..." while job is PENDING/PROCESSING (existing behavior), the `<video>` player once `videoUrl` arrives on the DONE event, and a "No clips found" message when `stitchedTranscript` is empty (no matches → no video). Tab remains visible in all DONE states.

### Claude's Discretion
- FFmpeg wrapper choice (fluent-ffmpeg vs direct child_process)
- FFmpeg binary package (ffmpeg-static, @ffmpeg-installer/ffmpeg, or similar)
- Supabase Storage bucket name and file path convention
- Exact retention window constant value (24h recommended default)
- Worker cleanup query batching / limit to avoid scanning all rows on every tick
- FFmpeg concat filter vs demuxer for segment stitching
- Prisma field names (videoUrl, videoExpiresAt, or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Core value, constraints (YouTube-first, anonymous, low-cost, free tiers only, temporary storage)
- `.planning/REQUIREMENTS.md` — Phase 4 covers VID-01, VID-02, VID-03, VID-04, JOB-03
- `.planning/ROADMAP.md` — Phase 4 goal and plan breakdown (04-01: extraction; 04-02: stitching + playback; 04-03: storage/serving/cleanup)

### Prior Phase Context
- `.planning/phases/03-context-clip-plan-and-stitched-transcript/03-CONTEXT.md` — D-01 (context expansion algorithm), D-03 (StitchedTranscriptEntry schema: `{sourceStartMs, sourceEndMs, text}`), D-04 (stitchedTranscript Json? column), D-06 (tab layout with Video/Transcript/Notes tabs already scaffolded)
- `.planning/phases/02-transcript-and-exact-search/02-CONTEXT.md` — D-09 (Railway worker), D-10 (polling loop), ClipMatch shape
- `.planning/phases/01-anonymous-job-shell/01-CONTEXT.md` — D-02 (Railway worker architecture), D-03/D-04 (Supabase + Prisma), D-15 (free tiers)

### Existing Code
- `worker/src/index.ts` — Worker polling loop and `processPendingJob()`; Phase 4 extends the pipeline after `buildStitchedTranscript()` with video download + FFmpeg + Supabase Storage upload
- `worker/src/types.ts` — `StitchedTranscriptEntry` interface (`sourceStartMs`, `sourceEndMs`, `text`); these timestamps are the segment boundaries for FFmpeg extraction
- `worker/src/contextExpander.ts` — `mergeOverlappingWindows()` output (ExpandedWindow[]) is the direct input to Phase 4's extraction step
- `prisma/schema.prisma` — Current Job model; Phase 4 adds `videoUrl String?` and `videoExpiresAt DateTime?` columns
- `src/components/status-view.tsx` — Video tab already scaffolded with placeholder text; Phase 4 replaces it with `<video>` player; `videoUrl` field added to Realtime payload alongside `stitchedTranscript`
- `src/types/job.ts` — Job interface; extend with `videoUrl` and `videoExpiresAt` fields

No external specs or ADRs beyond the above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worker/src/index.ts` → `processPendingJob()` — Phase 4 extends the pipeline: after `buildStitchedTranscript()`, add video download + FFmpeg segment extraction + stitching + Supabase Storage upload; `videoUrl` and `videoExpiresAt` added to the final `prisma.job.update()`
- `worker/src/types.ts` → `StitchedTranscriptEntry` — `sourceStartMs`/`sourceEndMs` map directly to FFmpeg `-ss` / `-to` time arguments (convert ms → seconds)
- `src/components/status-view.tsx` → Video tab's `<TabsContent value="video">` placeholder — replace the placeholder `<p>` with `<video controls src={videoUrl} />` when `videoUrl` is non-null
- `src/types/job.ts` → `Job` interface — extend with `videoUrl: string | null` and `videoExpiresAt: string | null`

### Established Patterns
- Prisma JSON columns (`transcript`, `clipPlan`, `stitchedTranscript`) — same pattern for `videoUrl` (String?) and `videoExpiresAt` (DateTime?)
- Worker writes via `prisma.job.update({ where: { id }, data: { ..., status: 'DONE' } })` — add `videoUrl` and `videoExpiresAt` to the same update call
- Supabase Realtime subscription in `status-view.tsx` already propagates job row changes — extend the payload handler to include `videoUrl`
- `mapTranscriptError()` pattern in `worker/src/transcript.ts` — model error mapping for video download/FFmpeg failures on the same FAILED path

### Integration Points
- Worker `processPendingJob()` → video pipeline runs after `buildStitchedTranscript()` — download video, extract segments, stitch, upload to Supabase Storage, return signed URL
- `videoUrl` flows from Job row → Supabase Realtime → `status-view.tsx` Video tab (same path as `stitchedTranscript`)
- Worker polling loop → add cleanup pass per tick: query `Job` where `videoExpiresAt < now AND videoUrl IS NOT NULL`, delete Supabase Storage files, null `videoUrl`
- Prisma migration required before worker can write `videoUrl`/`videoExpiresAt` fields

</code_context>

<specifics>
## Specific Ideas

- Free tiers only — this was explicitly confirmed. Supabase Storage free tier (1GB/2GB) is the storage target; no paid alternatives.
- `@distube/ytdl-core` for YouTube video download (Node-only, no Railway binary setup).
- Worker cleanup pass runs on every poll tick using the existing polling infrastructure — no separate cron job or scheduler.
- Video tab: `<video controls src={videoUrl} className="w-full rounded-md" />` — native HTML5 player, no custom player library.
- `videoExpiresAt` set to `new Date(Date.now() + RETENTION_MS)` at job completion; worker cleans up rows where this is past.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-stitched-video-output*
*Context gathered: 2026-06-25*
