# Research Summary: Clip-That

**Date:** 2026-06-07

## Stack

Recommended stack:

- Next.js frontend for the anonymous student workflow.
- FastAPI backend for job APIs.
- Python worker pipeline for transcript, matching, media processing, notes, and PDFs.
- `youtube-transcript-api` for YouTube captions/transcripts.
- `yt-dlp` and FFmpeg for media retrieval, segment extraction, and stitching.
- Optional embeddings/LLM layer for semantic matching and study notes.
- ReportLab for PDF generation.
- Temporary artifact storage with cleanup.

## Table Stakes

V1 needs:

- YouTube URL and topic submission.
- Anonymous use.
- Exact transcript matching.
- Optional semantic matching.
- Context windows around matches.
- One continuous stitched video.
- Transcript of the stitched video.
- Study notes focused on explanation, key points, and definitions.
- PDF download.
- Clear unsupported-video and failed-processing states.

## Watch Out For

- Not every YouTube video has a usable transcript.
- Downloading whole videos can be slow and expensive.
- Semantic matching can over-include irrelevant clips.
- Context windows must be merged to avoid duplicates.
- Notes must be grounded in the selected transcript, not the whole video.
- Anonymous artifacts need expiration and cleanup.
- Heavy video jobs should not depend on in-process-only background tasks in production.

## Roadmap Implications

Build transcript and clip planning before full media stitching. This makes the hardest product logic testable without waiting on FFmpeg output.

Suggested phase direction:

1. Project scaffold, anonymous job flow, and result shell.
2. YouTube transcript fetch and exact topic matching.
3. Clip planning with context windows and transcript output.
4. FFmpeg media extraction and stitched video output.
5. Study notes and PDF download.
6. Optional semantic matching.
7. Upload support and long-video optimization after YouTube v1 works.

## Sources

- yt-dlp README: https://github.com/yt-dlp/yt-dlp
- youtube-transcript-api PyPI: https://pypi.org/project/youtube-transcript-api/
- FFmpeg docs: https://ffmpeg.org/ffmpeg.html
- FastAPI BackgroundTasks docs: https://fastapi.tiangolo.com/tutorial/background-tasks/
- ReportLab user guide: https://docs.reportlab.com/reportlab/userguide/ch1_intro/
- Next.js docs: https://nextjs.org/docs
