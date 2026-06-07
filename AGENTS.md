<!-- GSD:project-start source:PROJECT.md -->

## Project

**Clip-That**

Clip-That is a web platform for students and learners who want to study video content faster. A user enters a YouTube video URL and a topic, then receives a stitched video containing the relevant parts of the source video, a transcript of that stitched video, and study notes that can be downloaded as a PDF.

**Core Value:** Students can turn a long video into a focused study artifact for a specific topic without rewatching the whole video.

### Constraints

- **Source support**: YouTube first - keeps the MVP focused and reduces source handling complexity.
- **Cost**: Low-cost operation - the platform should avoid expensive processing patterns where practical.
- **Storage**: Avoid permanent video storage - processed media should be temporary unless a later product decision changes this.
- **Access**: Anonymous v1 - users should not need accounts for the first version.
- **Reliability**: Works on most YouTube videos with usable captions or transcripts - videos without transcript access may not be supported initially.
- **Performance**: Long lecture support is desirable but optional - the first version can prioritize common videos before optimizing 30-90 minute processing.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommendation

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

## Suggested Initial Components

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

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
