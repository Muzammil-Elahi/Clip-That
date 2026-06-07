# Architecture Research: Clip-That

**Date:** 2026-06-07

## Recommended Architecture

Clip-That should be built as a web app plus processing backend:

```text
Browser
  -> Next.js frontend
  -> FastAPI backend
  -> Job store
  -> Processing worker
      -> transcript fetcher
      -> topic matcher
      -> clip planner
      -> media processor
      -> notes/PDF generator
  -> temporary artifact storage
```

## Data Flow

1. User submits YouTube URL, topic, and semantic mode toggle.
2. Backend validates the URL and creates a processing job.
3. Worker fetches YouTube transcript/captions.
4. Worker normalizes transcript text and creates timestamped chunks.
5. Exact matcher finds direct topic mentions.
6. If semantic mode is enabled, semantic matcher ranks related chunks.
7. Clip planner expands matches with context windows and merges overlaps.
8. Media processor retrieves/extracts required ranges and stitches them into one video.
9. Transcript builder creates a transcript for the stitched output.
10. Notes generator creates study notes from selected transcript spans.
11. PDF generator renders notes into a downloadable file.
12. Frontend displays video, transcript, notes, and download link.

## Component Boundaries

### Frontend

Owns:

- form UX
- anonymous job submission
- progress/status polling
- result display
- video playback
- transcript and notes layout
- PDF download link

Does not own:

- transcript retrieval
- media downloads
- FFmpeg processing
- LLM calls

### API

Owns:

- request validation
- job creation
- job status and result endpoints
- artifact access policy
- cleanup scheduling

Does not own:

- long-running processing inside request handlers

### Worker

Owns:

- transcript retrieval
- matching
- clip planning
- media processing
- notes and PDF generation
- retryable job execution
- temporary file cleanup

### Storage

Owns:

- temporary source fragments
- stitched video
- stitched transcript
- generated notes
- PDF

Artifacts should have time-to-live cleanup. Permanent storage is out of scope.

## Build Order

1. Static frontend shell and API job model.
2. Transcript fetch for YouTube videos with available captions.
3. Exact topic matching and context-window planning.
4. Result page with transcript-only preview of selected spans.
5. FFmpeg clip extraction and stitching.
6. Study-note generation and PDF download.
7. Optional semantic matching.
8. Cleanup, error states, and long-video guardrails.

This order reduces risk because transcript and clip planning can be validated before full media processing is built.

## Key Architecture Decisions

- Treat processing as asynchronous jobs from the beginning.
- Keep exact matching and semantic matching separate in the data model.
- Store a clip plan before rendering media so failures can be debugged.
- Timestamp every output back to the source video.
- Keep semantic matches explainable through matched transcript chunks.
- Use temporary artifacts with cleanup rather than a media library.

## Open Questions

- Which LLM provider should be used for notes and semantic search?
- Should semantic matching use embeddings only, or embeddings plus LLM review?
- What maximum video length should be allowed in v1?
- How long should anonymous artifacts remain downloadable?
