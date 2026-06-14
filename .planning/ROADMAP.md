# Roadmap: Clip-That

## Overview

Clip-That v1 builds from the lowest-risk proof points toward the full student workflow: first an anonymous job shell, then transcript retrieval and exact topic matching, then context-aware clip planning, then stitched video output, then study notes and PDF download. Optional semantic matching comes last so the core exact-match product remains usable and testable even before broader AI matching is added.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Anonymous Job Shell** - User can submit a YouTube URL and topic and track processing status.
- [ ] **Phase 2: Transcript and Exact Search** - System can retrieve YouTube transcripts and find exact topic mentions.
- [ ] **Phase 3: Context Clip Plan and Stitched Transcript** - System can build context windows and produce the transcript for selected segments.
- [ ] **Phase 4: Stitched Video Output** - System can extract, stitch, play, and expire generated video artifacts.
- [ ] **Phase 5: Study Notes and PDF** - User receives topic-specific study notes and can download them as a PDF.
- [ ] **Phase 6: Optional Semantic Matching** - User can enable semantic reference matching with confidence/reason indicators.

## Phase Details

### Phase 1: Anonymous Job Shell

**Goal**: Deliver the anonymous submission and job-status skeleton for the Clip-That workflow.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: [SUB-01, SUB-02, SUB-05, JOB-01, JOB-02]
**Success Criteria** (what must be TRUE):

  1. User can open the app and submit a YouTube URL plus topic without an account.
  2. User is routed to a job/result page after submission.
  3. User can see job status and clear failure messaging for failed jobs.

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking skeleton: scaffold Next.js 16 + Supabase + Prisma 7, Job model, submitJob Server Action, Vitest infrastructure

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Submission form: YouTube URL + topic inputs, inline validation, loading overlay, client routing to /status
- [x] 01-03-PLAN.md — Status view: Supabase Realtime subscription, progress bar + rotating messages, failure Alert, Done state

### Phase 2: Transcript and Exact Search

**Goal**: Retrieve timestamped YouTube transcripts and identify direct topic mentions.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: [SUB-03, TRN-01, TRN-02, TRN-03, MAT-01, CLP-01]
**Success Criteria** (what must be TRUE):

  1. System can retrieve timestamped transcript data for supported YouTube videos.
  2. System returns a clear unsupported-video state when transcript data is unavailable.
  3. System finds exact topic mentions and stores an initial clip plan from matching transcript spans.

**Plans**: 2 plans

Plans:

- [ ] 02-01: Implement YouTube transcript retrieval and unsupported-video handling.
- [ ] 02-02: Implement transcript normalization, exact matching, and initial clip-plan records.

### Phase 3: Context Clip Plan and Stitched Transcript

**Goal**: Expand matched moments into context-aware segments and produce the transcript for the future stitched output.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: [CLP-02, CLP-03, CLP-04, STR-01, STR-02, STR-03]
**Success Criteria** (what must be TRUE):

  1. System adds approximately 30 seconds of context before and after matches where available.
  2. System merges overlapping context windows before processing.
  3. User can view a stitched transcript that references original source timestamps.

**Plans**: 2 plans

Plans:

- [ ] 03-01: Implement context-window expansion, overlap merging, and source timestamp preservation.
- [ ] 03-02: Build stitched transcript generation and result-page transcript display.

### Phase 4: Stitched Video Output

**Goal**: Generate and play one continuous stitched video from the planned source segments.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: [VID-01, VID-02, VID-03, VID-04, JOB-03]
**Success Criteria** (what must be TRUE):

  1. System extracts planned video segments from the YouTube source.
  2. System stitches extracted segments into one continuous playable video.
  3. Anonymous video artifacts expire after a configured retention window.

**Plans**: 3 plans

Plans:

- [ ] 04-01: Implement media range retrieval and FFmpeg segment extraction.
- [ ] 04-02: Implement stitched video rendering and browser playback.
- [ ] 04-03: Implement temporary artifact storage, serving, and cleanup.

### Phase 5: Study Notes and PDF

**Goal**: Generate student-focused notes from selected transcript spans and provide a PDF download.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: [NOT-01, NOT-02, NOT-03, NOT-04, NOT-05]
**Success Criteria** (what must be TRUE):

  1. System generates notes only from the selected stitched transcript spans.
  2. Notes include clear explanation, key points, and definitions when supported by the source.
  3. User can download the notes as a PDF.

**Plans**: 2 plans

Plans:

- [ ] 05-01: Implement grounded study-note generation from stitched transcript spans.
- [ ] 05-02: Implement notes UI and PDF generation/download.

### Phase 6: Optional Semantic Matching

**Goal**: Add optional semantic reference matching without weakening the exact-match default.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: [SUB-04, MAT-02, MAT-03, MAT-04]
**Success Criteria** (what must be TRUE):

  1. User can enable semantic matching before processing.
  2. System can include semantically related transcript segments when the option is enabled.
  3. Semantic matches remain distinguishable from exact matches and include confidence or reason information.

**Plans**: 2 plans

Plans:

- [ ] 06-01: Implement transcript chunk embeddings and semantic retrieval.
- [ ] 06-02: Add semantic toggle behavior, match labeling, thresholds, and result explanations.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Anonymous Job Shell | 3/3 | Complete | 2026-06-13 |
| 2. Transcript and Exact Search | 0/2 | Not started | - |
| 3. Context Clip Plan and Stitched Transcript | 0/2 | Not started | - |
| 4. Stitched Video Output | 0/3 | Not started | - |
| 5. Study Notes and PDF | 0/2 | Not started | - |
| 6. Optional Semantic Matching | 0/2 | Not started | - |
