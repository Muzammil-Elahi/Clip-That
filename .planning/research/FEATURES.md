# Feature Research: Clip-That

**Date:** 2026-06-07
**Domain:** student-focused video topic extraction

## Table Stakes

### Input

- User can paste a YouTube URL.
- User can enter a topic or phrase.
- User can choose exact transcript matching.
- User can optionally enable semantic matching.
- User can submit without creating an account.

### Processing Feedback

- User sees that processing has started.
- User can see job status while transcript, clip, and notes work runs.
- User gets a clear unsupported-video state when transcript access is unavailable.
- User gets a clear failure state when video processing fails.

### Topic Detection

- System finds direct transcript mentions.
- System can include semantic references only when enabled.
- System includes context around each matched segment.
- System merges overlapping context windows to avoid duplicate repeated clips.
- System preserves timestamps from source video into the result metadata.

### Outputs

- One continuous stitched video.
- Transcript of the stitched video.
- Study notes with explanation, key points, and definitions.
- Downloadable PDF version of the notes.

## Differentiators

- Adjustable context window, such as 15, 30, or 60 seconds.
- Segment list with source timestamps.
- Confidence labels for semantic matches.
- "Why included?" explanation for each semantic segment.
- Study-note styles, such as beginner, exam prep, or concise review.
- Later: uploaded video support.

## Anti-Features

- Requiring login before first use.
- Permanent public clip hosting.
- Claiming support for every public video URL.
- Hiding whether semantic matching was used.
- Returning isolated clips when the desired output is one continuous video.
- Notes that summarize the whole video instead of the selected topic.

## V1 Feature Recommendation

V1 should include:

- Anonymous form: YouTube URL, topic, semantic toggle.
- Captions/transcript based extraction.
- Default context window of plus/minus 30 seconds.
- Exact matching as default.
- Optional semantic matching over transcript chunks.
- Clip-plan preview internally, even if not exposed in UI at first.
- Continuous stitched video output.
- Stitched transcript.
- Study notes and PDF download.

V2 should include:

- User-uploaded videos.
- Adjustable context settings.
- Segment list and manual include/exclude.
- Saved jobs/accounts if users ask for history.
- Better long-lecture optimization.

## Complexity Notes

- Transcript availability is the biggest v1 dependency.
- Media clipping is sensitive to timestamp accuracy, formats, and FFmpeg behavior.
- Semantic matching needs guardrails so it does not include unrelated discussion.
- PDF output is straightforward once notes are generated.
- Anonymous jobs need cleanup to avoid storage cost growth.
