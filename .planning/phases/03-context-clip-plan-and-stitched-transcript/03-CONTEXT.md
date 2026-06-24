# Phase 3: Context Clip Plan and Stitched Transcript - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 takes the `clipPlan` produced by Phase 2 (array of `ClipMatch` with `startMs`, `endMs`, `text`, `segmentIndices[]`) and expands each match into a context-aware segment by walking outward through transcript segment indices. It merges overlapping or adjacent context windows into a single span. From the final merged set of segments it generates a `stitchedTranscript` — an ordered array of entries each carrying source timestamps and text. The stitched transcript is stored on the Job record and displayed on the result page inside a new tab-based layout. Context expansion, overlap merging, source timestamp preservation, and the result-page transcript display are all in scope. Video extraction, stitching, study notes, and PDF generation are out of scope (Phases 4–5).

</domain>

<decisions>
## Implementation Decisions

### Context Window Expansion
- **D-01:** Context window algorithm — **Segment-boundary snapping** (Claude's discretion). Walk outward through the full transcript array from each `ClipMatch`'s outermost `segmentIndex` in both directions until cumulative duration ≥ 30 seconds. The expanded window always starts and ends at a natural transcript segment edge, preventing mid-sentence cuts in both the stitched transcript and the Phase 4 video extraction.
- **D-02:** Edge clip behavior — **Truncate silently**. When a match is near the video start or end, include whatever segments are available. No annotation or special marker — the source timestamps already reveal that the context window is shorter than 30s.

### Stitched Transcript Shape
- **D-03:** Entry schema — **`{ sourceStartMs, sourceEndMs, text }`** (Claude's discretion). Minimal and sufficient for STR-03 (source timestamp references). Each entry maps to the source video and is what Phase 4 needs for segment extraction.
- **D-04:** Storage — **New `stitchedTranscript Json?` column on the `Job` table**, consistent with the existing `transcript` and `clipPlan` pattern. Requires a Prisma migration.
- **D-05:** Gap markers — **None**. Non-adjacent context windows are stored sequentially without sentinel entries. Source timestamps on adjacent entries already reveal discontinuities. Simpler to render and store.

### Result Page Layout
- **D-06:** Tab container — **Introduce tab layout in Phase 3**: `Video | Transcript | Notes`. The Transcript tab is fully populated in this phase. The Video and Notes tabs are enabled and clickable but show a "coming soon" message (exact copy Claude's discretion — e.g., "Video clips will appear here after Phase 4"). This sets the final result-page layout from the start so Phases 4–5 fill tabs rather than restructure the page.
- **D-07:** Transcript entry rendering — **Claude's discretion**. Timestamp-plus-text-per-line (`[0:32] text...`) is the expected baseline — readable, no new dependencies, consistent with how transcripts are typically shown.

### Zero-Match Display
- **D-08:** Empty clip plan — When `clipPlan` is empty (topic not found), the `stitchedTranscript` is also empty and the job remains `DONE`. The Transcript tab shows a specific message: `No mentions of "[topic]" were found in this video.` Video and Notes tabs are unaffected.

### Claude's Discretion
- Context window size constant (30s default; exact value configurable by constant in worker)
- Exact copy for "coming soon" messages in Video and Notes tabs
- Transcript entry rendering format within the Transcript tab (timestamp-per-line baseline)
- Overlap/merge algorithm details (merge windows where expanded ranges overlap or are adjacent)
- Prisma field name for the new column (`stitchedTranscript` or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Core value, constraints, key decisions (YouTube-first, anonymous, low-cost, free tiers preferred)
- `.planning/REQUIREMENTS.md` — Phase 3 covers CLP-02, CLP-03, CLP-04, STR-01, STR-02, STR-03
- `.planning/ROADMAP.md` — Phase 3 goal and plan breakdown (03-01: context expansion + overlap merge; 03-02: stitched transcript generation + result-page display)

### Prior Phase Context
- `.planning/phases/02-transcript-and-exact-search/02-CONTEXT.md` — Decisions this phase builds on directly: D-02 (transcript format: `{ text, offset, duration }[]`), D-04 (`transcript Json?` column), D-05 (`clipPlan Json?` column), D-06/D-07/D-08 (matching and `ClipMatch` shape with `segmentIndices[]`)
- `.planning/phases/01-anonymous-job-shell/01-CONTEXT.md` — Architecture decisions: D-02 (worker on Railway), D-03/D-04 (Supabase + Prisma), D-15 (free tiers)

### Existing Code
- `worker/src/types.ts` — `TranscriptSegment` and `ClipMatch` interfaces; Phase 3 extends `ClipMatch` into context-expanded segments
- `worker/src/matcher.ts` — `buildClipPlan()` output is the input to Phase 3's context expansion
- `worker/src/index.ts` — Worker processing loop; Phase 3 adds context expansion and stitched transcript generation between `buildClipPlan()` and the final `prisma.job.update()`
- `prisma/schema.prisma` — Current `Job` model; Phase 3 adds `stitchedTranscript Json?` column
- `src/components/status-view.tsx` — Current result page component with Done-state placeholder; Phase 3 replaces this with the tab container and Transcript tab content
- `src/types/job.ts` — `Job` interface; Phase 3 extends with `stitchedTranscript` field

No external specs or ADRs beyond the above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worker/src/types.ts` → `TranscriptSegment`, `ClipMatch` — Phase 3 adds a new type for context-expanded segments (e.g., `ContextSegment`) or reuses `ClipMatch` with wider `startMs`/`endMs`
- `worker/src/matcher.ts` → `buildClipPlan()` — Returns `ClipMatch[]`; Phase 3 takes this as input and applies context expansion on top
- `worker/src/index.ts` → `processPendingJob()` — Phase 3 inserts context expansion + stitched transcript generation between `buildClipPlan()` and the final `prisma.job.update()` call
- `src/components/status-view.tsx` → Done state block (line 174–177) — Replace the placeholder `<p>` with the new tab container
- `src/components/ui/card.tsx`, `button.tsx`, `progress.tsx` — Shadcn components already installed; tab components may need to be added via shadcn (`npx shadcn add tabs`)

### Established Patterns
- Prisma JSON columns: `transcript Json?` and `clipPlan Json?` are the model for `stitchedTranscript Json?`
- Worker writes via `prisma.job.update({ data: { ..., status: 'DONE' } })` — add `stitchedTranscript` to the same update call
- Supabase Realtime subscription already propagates job row changes to the status page — no new subscription needed
- `src/types/job.ts` mirrors worker types; extend both `Job` interface and worker types in sync

### Integration Points
- Worker `processPendingJob()` → context expansion runs after `buildClipPlan()`, writes `stitchedTranscript` alongside `clipPlan` and `transcript` in the final update
- `stitchedTranscript` flows from Job row → Supabase Realtime → `status-view.tsx` on the DONE event (or via SSR on page load if already DONE)
- Result page tab layout: the Done state in `status-view.tsx` becomes the tab container; the Transcript tab renders `stitchedTranscript` entries; Video and Notes tabs show coming-soon messages

</code_context>

<specifics>
## Specific Ideas

- Tab layout introduced now so Phases 4–5 fill tabs rather than restructure the page. User wants tabs enabled (not disabled/greyed) with a "coming soon" type message inside the Video and Notes tabs.
- "No mentions of `[topic]` were found in this video." — specific no-match message inside the Transcript tab when `stitchedTranscript` is empty. Job remains DONE.
- Context expansion walks outward by segment index from `ClipMatch.segmentIndices` outermost boundaries until ≥ 30s of duration is accumulated in each direction.
- Overlap/adjacency merge should run after all matches are expanded, before stitched transcript generation — merge windows whose expanded ranges overlap or touch.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-context-clip-plan-and-stitched-transcript*
*Context gathered: 2026-06-23*
