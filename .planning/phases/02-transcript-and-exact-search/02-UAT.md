---
status: testing
phase: 02-transcript-and-exact-search
source: [02-VERIFICATION.md]
started: 2026-06-17T00:00:00Z
updated: 2026-06-17T23:00:00Z
---

## Current Test

number: 3
name: End-to-end FAILED path — no-caption video error message
expected: |
  Submit a no-caption video job, run the worker, confirm status=FAILED and error message in Supabase.
awaiting: user response

## Tests

### 1. SUB-03 interpretation — exact matching as default mode
expected: Product owner confirms "User can choose exact transcript matching" is satisfied by exact matching being the only mode in Phase 2 (semantic matching arrives in Phase 6), with no UI toggle required now.
result: pass

### 2. End-to-end DONE path — transcript + clip plan written to DB
expected: |
  Steps:
  1. Set WORKER_DATABASE_URL in .env.local (Supabase postgres service role URL)
  2. Submit a job from the UI for a captioned YouTube video (e.g. a known lecture) with a topic word that appears in the transcript
  3. Run the worker: `cd worker && node --experimental-strip-types src/index.ts`
  4. In Supabase dashboard → Table Editor → job row:
     - status = DONE
     - transcript = non-null JSON array of {text, offset, duration} objects
     - clipPlan = JSON array of ClipMatch objects with startMs, endMs, text, segmentIndices
result: [pending]

### 3. End-to-end FAILED path — no-caption video error message
expected: |
  Steps:
  1. Submit a job for a YouTube video with no captions (e.g. a music video or livestream without auto-captions)
  2. Run the worker
  3. In Supabase dashboard → job row:
     - status = FAILED
     - errorMessage = "This video doesn't have a usable transcript."
result: [pending]

## Summary

total: 3
passed: 1
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
