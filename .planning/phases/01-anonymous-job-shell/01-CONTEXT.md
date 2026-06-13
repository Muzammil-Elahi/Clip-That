# Phase 1: Anonymous Job Shell - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the anonymous submission and job-status skeleton for Clip-That. This includes: the web app scaffold (Next.js + Supabase), the anonymous submission form (YouTube URL + topic), the job record model, the loading overlay and transition to the results page, and the status/failure display. No transcript retrieval, matching, or video processing occurs in this phase — only the shell that later phases plug into.

</domain>

<decisions>
## Implementation Decisions

### Tech Stack
- **D-01:** Frontend framework — **Next.js** (full-stack React, App Router).
- **D-02:** Backend structure — **Next.js API routes** for the web layer + **separate Node.js worker process** on Railway for all media processing (FFmpeg, transcript work, stitching). The worker communicates via Supabase (writes job status directly to the database).
- **D-03:** Database and backend services — **Supabase** (managed PostgreSQL, Realtime, Storage, Anonymous Auth). Supabase is the single backend infrastructure layer.
- **D-04:** ORM — **Prisma** for database schema and migrations (works with Supabase PostgreSQL). The `supabase-js` client is used alongside Prisma for Realtime subscriptions, Storage, and Auth.

### Job Ownership and Lifecycle
- **D-05:** Results are **ephemeral — deleted on view**. Once the results page loads and the user sees the output, the job and all artifacts are scheduled for deletion. There is no permanent storage of results.
- **D-06:** Users can **download results** (stitched video, PDF notes) while on the results page before they leave.
- **D-07:** **Job ID is not exposed in the URL**. After submission, a loading overlay appears on the submit page, then transitions to a results/status view. The job ID is tracked in the **Supabase anonymous auth session** (not in the URL or a separate session cookie). If the user reloads, the session still links them to their job while it is active.
- **D-08:** Anonymous user identity is managed by **Supabase Anonymous Auth** — the user gets a temporary session on first visit, and their job is tied to that session.

### Status Page
- **D-09:** Status updates use **Supabase Realtime subscriptions** — the status page subscribes to changes on the job row. When the worker updates the job status in the database, the UI updates automatically without polling.
- **D-10:** While processing, the UI shows a **progress bar + rotating status message** (e.g., "Finding your topic in the video…", "Building your clip…"). Not a bare spinner — the user gets feedback on what is happening.
- **D-11:** Failure state — **plain-language error message + "Try again" button** that returns the user to the submission form. Error messages should be human-readable (e.g., "This video doesn't have a usable transcript.") — no raw error codes or stack traces.

### Deployment
- **D-12:** **Vercel** for the Next.js frontend and API routes.
- **D-13:** **Railway** for the Node.js worker process. Railway gives the worker persistent compute with FFmpeg support.
- **D-14:** **Supabase** (free tier) for PostgreSQL, Realtime, Storage, and Anonymous Auth.
- **D-15:** **Prefer free tiers and free APIs throughout the project.** When choosing libraries, services, or APIs, default to the free option unless there is a specific capability gap.

### Claude's Discretion
- Exact Prisma schema field names and types for the job model.
- Supabase Storage bucket naming and folder structure for artifacts.
- Specific rotating status messages shown during processing.
- Error handling middleware and logging patterns in Next.js API routes.
- Worker process structure (polling Supabase for new jobs, or Supabase Realtime trigger).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Core value, constraints, key decisions (YouTube-first, anonymous, low-cost)
- `.planning/REQUIREMENTS.md` — Full requirement list; Phase 1 covers SUB-01, SUB-02, SUB-05, JOB-01, JOB-02
- `.planning/ROADMAP.md` — Phase goals and plan breakdown

No external specs or ADRs yet — requirements fully captured in decisions above and in REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is a greenfield project. Phase 1 creates the scaffold.

### Established Patterns
- None yet — Phase 1 establishes the patterns all subsequent phases will follow.

### Integration Points
- Phase 1 creates the job model and submission flow that Phases 2–6 extend. The `Job` table schema and status state machine defined here must be designed to accommodate future fields (transcript, clip plan, artifacts, notes).

</code_context>

<specifics>
## Specific Ideas

- The submit page shows a **loading overlay** (not an instant redirect) after the user submits, then transitions to the results page once the job is created and processing begins. The URL does not change to expose the job ID.
- On the results page, the progress bar + status messages remain until the job reaches `done` or `failed`.
- Once results load, the user can download the outputs (video, PDF). After they leave the page (or on page close), artifacts are deleted.
- Supabase Realtime is the live update mechanism — the results page subscribes to the job row and reacts to status changes pushed by the worker.

</specifics>

<deferred>
## Deferred Ideas

- **Saved job history** — requires user accounts, deferred to v2.
- **Shareable result links** — deferred; v1 results are ephemeral and single-viewer.
- **Job retry from the results page** — could be added later; for now the failure state just sends the user back to the submission form.

</deferred>

---

*Phase: 1-anonymous-job-shell*
*Context gathered: 2026-06-12*
