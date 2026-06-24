# Phase 3: Context Clip Plan and Stitched Transcript - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 03-context-clip-plan-and-stitched-transcript
**Areas discussed:** Context window snapping, Stitched transcript shape, Result page transcript UI, Zero-match display

---

## Context Window Snapping

| Option | Description | Selected |
|--------|-------------|----------|
| Snap to segment boundary | Walk outward through segmentIndices until cumulative duration ≥ 30s. No mid-sentence cuts. | You decide |
| Exact ms offsets | Add/subtract exactly 30000ms from startMs/endMs. Clean math but may cut mid-sentence. | |
| You decide | Claude picks. | ✓ |

**User's choice:** You decide
**Notes:** Claude chose segment-boundary snapping — cleaner for both transcript display and Phase 4 video extraction.

### Edge clip behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Truncate silently | Include whatever segments are available; no annotation. | ✓ |
| Annotate partial context | Mark entries to indicate partial context (e.g., `[start of video]`). | |
| You decide | Claude picks. | |

**User's choice:** Truncate silently

---

## Stitched Transcript Shape

### Entry schema

| Option | Description | Selected |
|--------|-------------|----------|
| { sourceStartMs, sourceEndMs, text } | Minimal, sufficient for STR-03. | |
| { sourceStartMs, sourceEndMs, text, role } | Adds 'match'/'context' role field for UI distinction. | |
| You decide | Claude picks based on what Phase 4/5 likely need. | ✓ |

**User's choice:** You decide
**Notes:** Claude chose minimal `{ sourceStartMs, sourceEndMs, text }` — sufficient for STR-03, what Phase 4 needs.

### Storage

| Option | Description | Selected |
|--------|-------------|----------|
| New JSON column on Job | Add `stitchedTranscript Json?` alongside `transcript` and `clipPlan`. | ✓ |
| Derived at read time | Re-compute from clipPlan + transcript on each page load. No migration. | |

**User's choice:** New JSON column on Job

### Gap markers

| Option | Description | Selected |
|--------|-------------|----------|
| No gap marker | Entries are sequential; source timestamps reveal discontinuities. | ✓ |
| Gap marker entry | Insert sentinel entry between non-adjacent windows. | |
| You decide | Claude picks. | |

**User's choice:** No gap marker

---

## Result Page Transcript UI

### Layout approach

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs now (Video \| Transcript \| Notes) | Introduce tab layout in Phase 3; Video and Notes fill in Phases 4–5. | ✓ |
| Stacked sections | Transcript section below Done card; sections grow each phase. | |
| Transcript replaces card | Done card becomes the transcript view. | |

**User's choice:** Tabs now (Video | Transcript | Notes)

### Video and Notes tab state

| Option | Description | Selected |
|--------|-------------|----------|
| Greyed out / disabled tabs | Non-interactive; no placeholder content. | |
| Enabled with coming-soon message | Tabs enabled but show a "coming soon" type message. | |

**User's choice:** Recommended (greyed out) but add a coming-soon message
**Notes:** User clarified they want tabs enabled (not disabled), showing a coming-soon message when clicked. Combination of both options.

### Transcript entry rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Timestamp + text per line | `[0:32] text...` — scrollable list, no new dependencies. | |
| Continuous text with inline timestamps | Text flows as paragraphs with `[0:32]` inline markers. | |
| You decide | Claude picks. | ✓ |

**User's choice:** You decide

---

## Zero-Match Display

| Option | Description | Selected |
|--------|-------------|----------|
| No-match message in Transcript tab | Transcript tab shows: `No mentions of "[topic]" were found in this video.` Job stays DONE. | ✓ |
| FAILED state with no-match error | Treat empty clipPlan as failure with a clear error message. | |
| Leave Done as-is (empty tabs) | No special handling; Transcript tab is just empty. | |

**User's choice:** Specific no-match message in Transcript tab (Recommended)

---

## Claude's Discretion

- Context window algorithm: segment-boundary snapping (30s threshold)
- Context window size constant: 30s (configurable by constant in worker)
- Stitched transcript entry schema: `{ sourceStartMs, sourceEndMs, text }`
- Transcript entry rendering: timestamp-per-line baseline (`[0:32] text...`)
- Exact copy for "coming soon" messages in Video and Notes tabs
- Prisma field name for new column (`stitchedTranscript` or similar)

## Deferred Ideas

None — discussion stayed within phase scope.
