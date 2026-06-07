# Pitfalls Research: Clip-That

**Date:** 2026-06-07

## Critical Pitfalls

### 1. Assuming Every YouTube Video Has a Usable Transcript

**Warning signs:**

- jobs fail before matching starts
- transcript fetch returns disabled, missing, or language-mismatched captions
- users paste videos with no captions

**Prevention:**

- make transcript availability a first-class validation result
- show clear unsupported-video messaging
- defer audio transcription fallback unless needed for v1

**Phase impact:** early transcript phase

### 2. Downloading Whole Videos When Only Segments Are Needed

**Warning signs:**

- high storage use
- slow processing on long lectures
- poor cost profile

**Prevention:**

- build a clip plan first
- retrieve only needed ranges where feasible
- cap video length and output length for v1
- cleanup temporary files aggressively

**Phase impact:** media processing phase

### 3. Semantic Matching Includes Irrelevant Segments

**Warning signs:**

- stitched video includes loosely related but unhelpful sections
- notes mention content not directly present in selected clips
- students cannot tell why a segment was included

**Prevention:**

- keep semantic matching optional
- store match reason and confidence
- start with conservative thresholds
- include exact matches separately from semantic references

**Phase impact:** semantic matching phase

### 4. Context Windows Create Duplicates or Awkward Cuts

**Warning signs:**

- repeated segments in stitched output
- abrupt clip starts and endings
- overlapping windows stitched as separate clips

**Prevention:**

- merge overlapping windows before media processing
- enforce minimum and maximum segment lengths
- preserve source timestamps in clip plan
- test with dense mention clusters

**Phase impact:** clip planning and media stitching

### 5. Notes Summarize the Whole Video Instead of the Topic Clip

**Warning signs:**

- notes include unrelated sections
- notes do not match the stitched transcript
- definitions are invented or detached from source context

**Prevention:**

- generate notes only from selected transcript spans
- include source timestamps in note-generation context
- prefer grounded study-note format: explanation, key points, definitions

**Phase impact:** notes/PDF phase

### 6. Anonymous Use Causes Unbounded Storage Growth

**Warning signs:**

- artifacts accumulate without owners
- local disk fills
- cloud storage costs grow silently

**Prevention:**

- give every job an expiration time
- cleanup source fragments and output artifacts
- avoid permanent video storage in v1

**Phase impact:** job/storage phase

### 7. In-Process Background Tasks Fail Under Real Load

**Warning signs:**

- jobs die when the web server restarts
- concurrent jobs block request handling
- no retry or progress visibility

**Prevention:**

- design a job model from the start
- use FastAPI background tasks only for local experiments or small tasks
- move video processing to an out-of-process worker before production

**Phase impact:** backend architecture phase

## Security and Policy Watchpoints

- Validate and restrict URLs to supported YouTube hosts.
- Avoid server-side request forgery through arbitrary URL fetching.
- Do not store source videos permanently.
- Avoid exposing local artifact paths.
- Consider YouTube terms, copyright, and acceptable use before public launch.
- Rate limit anonymous submissions.
