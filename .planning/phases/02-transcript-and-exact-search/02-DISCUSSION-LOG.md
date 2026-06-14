# Phase 2: Transcript and Exact Search - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 02-transcript-and-exact-search
**Areas discussed:** Transcript library, Data model expansion, Exact match behavior, Worker vs API route

---

## Transcript Library

| Option | Description | Selected |
|--------|-------------|----------|
| youtube-transcript | Lightweight npm package, no API key, uses YouTube internal caption endpoint | |
| youtube-transcript-plus | Updated variant of youtube-transcript | ✓ |
| youtubei.js | Full YouTube client, more robust, no API key | |
| yt-dlp (CLI) | Highly reliable, requires binary on Railway | |
| YouTube Data API v3 | Official, requires API key, has quota limits | |

**User's choice:** `youtube-transcript-plus` (initially selected `youtube-transcript`, then corrected to `youtube-transcript-plus`)
**Notes:** Preference for free, no-API-key approach.

---

## Transcript Format

| Option | Description | Selected |
|--------|-------------|----------|
| Use as-is | Keep raw `{text, start, duration}` array from the package | ✓ |
| Convert to `{text, startMs, endMs}` | Normalize to milliseconds, compute endMs during retrieval | |
| You decide | Planner chooses format | |

**User's choice:** Use as-is
**Notes:** Downstream phases can derive any format they need.

---

## No-Transcript Handling (TRN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| FAILED with specific error message | Set job to FAILED, user-facing message like "This video doesn't have a usable transcript." | ✓ |
| New status: UNSUPPORTED | Add distinct status for no-transcript vs processing error | |
| You decide | Planner picks most pragmatic approach | |

**User's choice:** FAILED with specific error message
**Notes:** Reuses the existing Phase 1 failure-state UI. No schema changes needed for the status enum.

---

## Data Model — Transcript Storage

| Option | Description | Selected |
|--------|-------------|----------|
| JSON column on Job table | Add `transcript Json?` to Prisma Job model | ✓ |
| Separate Transcript table | New Prisma model with foreign key | |
| Supabase Storage (file) | Store as JSON file in a bucket | |

**User's choice:** JSON column on Job table
**Notes:** User asked about long videos. Recommendation given: typical 30–90 min transcripts are 120KB–480KB, well within PostgreSQL's comfort zone. Supabase Storage is better suited for file-like artifacts (videos, PDFs).

---

## Data Model — Clip Plan Storage

| Option | Description | Selected |
|--------|-------------|----------|
| JSON column on Job table | Add `clipPlan Json?` to Prisma Job model | ✓ |
| Separate ClipPlan table | New Prisma model, one row per matched segment | |

**User's choice:** JSON column on Job table
**Notes:** Consistent with transcript storage decision. Planner to define the ClipPlan JSON shape.

---

## Exact Match — Normalization

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive substring | Topic appears anywhere in segment text, ignoring case | |
| Full-word boundary match | Topic must appear as complete words | |
| Normalized + tokenized | Strip punctuation, normalize whitespace, lowercase before comparing | ✓ |

**User's choice:** Normalized + tokenized
**Notes:** Handles caption artifacts (mid-phrase punctuation, extra spaces from auto-captions).

---

## Exact Match — Multi-word Phrases

| Option | Description | Selected |
|--------|-------------|----------|
| Adjacent phrase match | Words must appear in order and adjacent | ✓ |
| Same-segment, any position | All words must appear somewhere in the segment | |
| You decide | Planner chooses | |

**User's choice:** Adjacent phrase matching (with cross-segment check)
**Notes:** User asked for a recommendation given that context window is added in Phase 3. Recommendation: adjacent phrase is most predictable for students. Cross-segment pair check added to handle caption splits.

---

## Worker — Location

| Option | Description | Selected |
|--------|-------------|----------|
| Scaffold Railway worker in Phase 2 | Build worker now per D-02 architecture | ✓ |
| Next.js API route for now, migrate later | Simpler short-term, migration cost later | |

**User's choice:** Scaffold Railway worker in Phase 2
**Notes:** Follows the D-02 decision from Phase 1. Phase 2 is the natural entry point.

---

## Worker — Job Pickup

| Option | Description | Selected |
|--------|-------------|----------|
| Polling loop | Worker queries Supabase for PENDING jobs on an interval | ✓ |
| Supabase Realtime subscription | Worker subscribes to INSERT events on Job table | |
| You decide | Planner picks for Railway keep-alive model | |

**User's choice:** Polling loop
**Notes:** Simple, reliable, no persistent WebSocket connection required.

---

## Claude's Discretion

- Polling interval (3–5 seconds suggested as default)
- Exact Prisma field names for JSON columns
- ClipPlan JSON shape (must include source timestamps for Phase 3)
- Worker project structure (monorepo subfolder vs. `worker/` at root)
- Worker error handling and retry behavior

## Deferred Ideas

None — discussion stayed within phase scope.
