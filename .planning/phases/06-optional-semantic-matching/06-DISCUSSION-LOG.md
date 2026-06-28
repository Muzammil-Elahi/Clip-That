# Phase 6: Optional Semantic Matching - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 06-optional-semantic-matching
**Areas discussed:** Semantic engine approach

---

## Gray Area Selection

| Area | Selected for discussion |
|------|------------------------|
| Semantic engine approach | ✓ |
| Toggle UX on form | — (deferred to Claude's discretion) |
| Match labeling + confidence | — (deferred to Claude's discretion) |

---

## Semantic Engine Approach

### Q1: How should the worker find semantically related transcript segments?

| Option | Description | Selected |
|--------|-------------|----------|
| Gemini embeddings | text-embedding-004, free tier (1500 RPM), SDK already installed, cosine similarity, deterministic | ✓ |
| LLM-based (single Gemini call) | Send full transcript to Gemini Flash to identify related passages; simpler but uses tokens on every match call | |
| Hybrid — embeddings filter, LLM explain | Embeddings to find candidates, Gemini to write a reason sentence per match | |

**User's choice:** Gemini embeddings (text-embedding-004)
**Notes:** Aligns with free-tier constraint from Phase 4 (D-01). SDK already present from Phase 5.

---

### Q2: How should the transcript be chunked for embedding?

| Option | Description | Selected |
|--------|-------------|----------|
| Individual segments | Embed each TranscriptSegment as-is; timestamps map cleanly, no boundary reconciliation | ✓ |
| Fixed-size windows (5 segments) | Group into overlapping windows before embedding; better context but complicates timestamp mapping | |
| Let Claude decide | Claude picks chunking strategy at runtime | |

**User's choice:** Individual segments
**Notes:** Preserves the one-to-one mapping between similarity score and ClipMatch timestamps.

---

### Q3: How should the similarity threshold and result cap work?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed threshold + cap | Cosine similarity ≥ ~0.75, max 10 semantic matches; predictable, bounded video length | ✓ |
| Top-N only (no threshold) | Always return top 5 regardless of score; consistent count but may include low-relevance segments | |
| Let Claude decide | Claude calibrates threshold from score distribution at runtime | |

**User's choice:** Fixed threshold + cap (exact values at Claude's discretion)

---

### Q4: Where should GEMINI_API_KEY come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing GEMINI_API_KEY | Same env var, same SDK; no new Railway config needed | ✓ |
| Separate GEMINI_EMBED_API_KEY | Separate key for embeddings vs generative; separate quotas at cost of extra env var | |

**User's choice:** Reuse existing GEMINI_API_KEY

---

## Claude's Discretion

- **Toggle UX** — Not discussed; Claude picks placement (checkbox below topic field) and label (student-friendly, e.g. "Also find related references")
- **Match labeling** — Not discussed; Claude decides whether/how to surface matchType and confidence in the Transcript tab UI
- **Exact threshold value** — Approximately 0.75; Claude calibrates based on text-embedding-004 characteristics
- **Exact cap value** — Approximately 5–10 matches; Claude picks within that range
- **Semantic module filename** — Probably `worker/src/semanticMatcher.ts`
- **Embedding batch size** — Claude manages to stay within free-tier rate limits

## Deferred Ideas

None — discussion stayed within phase scope.
