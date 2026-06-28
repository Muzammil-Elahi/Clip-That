---
status: testing
phase: 06-optional-semantic-matching
source: [06-VERIFICATION.md]
started: 2026-06-28T12:30:00Z
updated: 2026-06-28T12:30:00Z
---

## Current Test

number: 1
name: Submit with checkbox checked — semanticEnabled=true stored and worker runs semantic path
expected: |
  Checkbox appears below the topic field. Submitting with it checked stores semanticEnabled=true
  in the Job row (verify in Supabase dashboard or worker log showing 'semanticEnabled: true'
  in semantic_matching_complete event).
awaiting: user response

## Tests

### 1. Submit with checkbox checked
expected: |
  Checkbox appears below the topic field on the submission form.
  Submitting with it checked stores semanticEnabled=true in the Job row.
  Worker log shows: { event: 'semantic_matching_complete', semanticEnabled: true, ... }
result: [pending]

### 2. Submit with checkbox unchecked (default)
expected: |
  Submitting with checkbox unchecked (default state) writes semanticEnabled=false to the Job row.
  Worker skips the semantic path — no 'semantic matches:' log line appears.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
