# Stack Research: Clip-That

**Date:** 2026-06-07
**Domain:** YouTube topic search, video clipping, transcription, study-note generation

## Recommendation

Use a Python processing backend with a lightweight web frontend:

- **Frontend:** Next.js App Router with TypeScript
- **API/backend:** FastAPI
- **Job execution:** Start with FastAPI job records plus an out-of-process worker path; avoid relying on in-process background tasks for video processing beyond local MVP experiments
- **Transcript retrieval:** `youtube-transcript-api` for videos with available YouTube captions/transcripts
- **Media retrieval and clipping:** `yt-dlp` plus FFmpeg
- **Exact topic matching:** transcript segment matching with normalized text and synonym expansion later
- **Optional semantic matching:** embeddings over transcript chunks, gated by a user toggle
- **Notes generation:** LLM-generated study notes from selected transcript spans, with timestamp grounding
- **PDF generation:** ReportLab
- **Storage:** temporary local storage for MVP, with object storage later for deployed processing

## Rationale

Python is the right center of gravity because the core work is transcript extraction, media processing, AI processing, and PDF generation. FastAPI is a practical API layer, while Next.js gives a strong frontend surface for the anonymous URL-plus-topic workflow.

`youtube-transcript-api` is a direct fit for the first source path: PyPI lists release 1.2.4 from 2026-01-29 and describes it as retrieving YouTube transcripts/subtitles, including automatically generated subtitles, without Selenium/headless browser overhead. Source: https://pypi.org/project/youtube-transcript-api/

`yt-dlp` is the most practical media retrieval tool for YouTube-first clipping. Its README describes broad site support, FFmpeg as an important dependency, and support for downloading time ranges via `--download-sections`. Source: https://github.com/yt-dlp/yt-dlp

FFmpeg should own segment extraction, normalization, and final stitching. Official FFmpeg docs document complex filtergraphs, and FFmpeg's own FAQ points to concat workflows for joining media. Sources: https://ffmpeg.org/ffmpeg.html and https://ffmpeg.org/faq.html

FastAPI `BackgroundTasks` can return a response before slow work finishes, but its docs explicitly call out bigger tools such as Celery for heavy background computation or work that can run outside the same process. Clip-That's video pipeline is heavy enough that durable jobs should be planned early. Source: https://fastapi.tiangolo.com/tutorial/background-tasks/

ReportLab is a direct PDF-generation fit: its docs describe creating PDF documents from Python and dynamic PDF generation on the web. Source: https://docs.reportlab.com/reportlab/userguide/ch1_intro/

Next.js is appropriate for the student-facing app because the official docs support App Router, route handlers, forms, data fetching, error handling, and deployment patterns in one framework. Source: https://nextjs.org/docs

## Suggested Initial Components

1. **Web app**
   - URL/topic form
   - exact vs semantic toggle
   - processing status page
   - stitched video player
   - transcript panel
   - notes panel and PDF download

2. **Backend API**
   - create processing job
   - fetch transcript
   - detect topic spans
   - create clip plan
   - process video
   - generate transcript and notes
   - serve temporary artifacts

3. **Worker pipeline**
   - validate URL
   - fetch transcript
   - chunk transcript by time
   - rank exact and semantic matches
   - merge overlapping context windows
   - download/extract needed media ranges
   - stitch final video
   - generate notes and PDF

## What Not To Use Initially

- **Full account/auth system:** explicitly out of scope for v1.
- **Arbitrary video-source abstraction:** YouTube-first is enough; other sources should wait.
- **Permanent video library:** conflicts with low-cost and no-permanent-storage constraints.
- **Semantic-only search:** exact matching needs to remain predictable and auditable.
- **In-process-only background work in production:** video jobs need progress tracking, retries, and cleanup.

## Confidence

- Python/FastAPI/FFmpeg/yt-dlp path: High
- Next.js frontend path: Medium-high
- `youtube-transcript-api` reliability across all YouTube videos: Medium, because availability depends on captions/transcript access
- Semantic matching as optional mode: High
- Long lecture performance in v1: Medium-low until the processing pipeline is measured
