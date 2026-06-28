---
status: testing
phase: 05-study-notes-and-pdf
source: [05-VERIFICATION.md]
started: 2026-06-27T19:58:00Z
updated: 2026-06-27T19:58:00Z
---

## Current Test

number: 1
name: PDF Download — Browser File Download
expected: |
  With GEMINI_API_KEY set and migration applied, open a completed job with studyNotes,
  click the Notes tab, click "Download PDF". Browser downloads study-notes-{topic}.pdf
  containing: topic header in 20pt Helvetica, Markdown-stripped notes body,
  "Source: {youtubeUrl}" footer, A4 page.
awaiting: user response

## Tests

### 1. PDF Download — Browser File Download

expected: |
  Open a completed job page that has studyNotes populated (requires GEMINI_API_KEY set
  in worker/.env.local and Railway, and the Prisma migration applied via
  `npx prisma migrate deploy`).
  Click the Notes tab. Click "Download PDF".
  Browser should download a file named study-notes-{topic}.pdf.
  Open the PDF: verify it contains the topic header, notes body (no raw Markdown syntax),
  and a "Source: {youtubeUrl}" footer.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
