# Phase 1: Anonymous Job Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 1-anonymous-job-shell
**Areas discussed:** Tech Stack, Job Ownership, Status Page Updates, Deployment Target

---

## Tech Stack

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js | Full-stack React — handles routing, API routes, and SSR in one repo. | ✓ |
| React + Vite (SPA) | Pure frontend SPA, pair with a separate backend. | |
| SvelteKit | Lighter than Next.js, great DX, full-stack. | |

**User's choice:** Next.js

---

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js API routes + separate worker | Next.js handles the web layer; a separate Node.js worker handles media jobs. | ✓ |
| Next.js API routes only | Keep everything in Next.js, figure out worker pattern later. | |
| Next.js + FastAPI (Python worker) | Python backend for heavy processing and future ML work. | |

**User's choice:** Next.js API routes + separate Node.js worker

---

| Option | Description | Selected |
|--------|-------------|----------|
| PostgreSQL | Relational, great for jobs with status/metadata, strong JSON support. | ✓ |
| SQLite | Zero-config, file-based — not production-ready for concurrent access. | |
| MongoDB | Flexible schema for job documents. | |

**User's choice:** PostgreSQL (via Supabase)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Prisma | Type-safe ORM with great Next.js integration, auto-generated types. | ✓ |
| Drizzle ORM | Lighter, SQL-first, excellent TypeScript types. | |
| Raw SQL (pg / postgres.js) | No ORM overhead, full control. | |

**User's choice:** Prisma

---

## Job Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| URL with job ID | Redirect to /jobs/[jobId]. Simple and stateless. | |
| Session cookie + job ID | Session cookie ties the user to their jobs. | |
| Share link only | Generate a secret share URL. | |

**User's choice:** Free-text response — "the user will be able to see the results once. Which will not be saved into any database so if they leave the page its gone forever. However they can download the results if they wish to."
**Notes:** Ephemeral results — shown once, deleted on view. Users can download while on the page.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Delete on view | Once results page loads, schedule job + artifacts for deletion. | ✓ |
| Keep for a short window (1 hour) | Results stay accessible for a short time. | |
| Keep until download | Persist until user explicitly downloads, then delete. | |

**User's choice:** Delete on view

---

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to /jobs/[jobId] immediately | After submitting, go straight to the job status page. | |
| Stay on submit page, show inline status | Submission form transforms into a status tracker in-place. | |
| Show loading overlay, then replace URL | Block submit page until processing starts, then redirect. | ✓ |

**User's choice:** Show a loading overlay, then replace URL

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — /jobs/[jobId] in URL | Clean, bookmarkable while processing. | |
| No — hide job ID, use session state | Job ID kept in memory or session only. | ✓ |

**User's choice:** No — hide job ID, use session state

---

## Status Page Updates

| Option | Description | Selected |
|--------|-------------|----------|
| Polling | Browser checks every 2–3 seconds. Simple, no persistent connection. | ✓ (later superseded by Supabase Realtime) |
| Server-Sent Events (SSE) | Server pushes status updates over persistent HTTP. | |
| WebSocket | Bidirectional real-time connection. Overkill for this use case. | |

**User's choice:** Initially polling, later updated to Supabase Realtime subscriptions when Supabase was chosen as the backend.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Simple: pending → processing → done / failed | Clean, minimal states. | |
| Detailed pipeline states | Shows each backend step. | |
| Progress bar only | Just a percentage or indeterminate spinner. | ✓ |

**User's choice:** Progress bar only (then upgraded to progress bar + status message)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Simple error message + try again button | Plain language error + button to resubmit. | ✓ |
| Error code + generic message | A code for support reference. | |
| Full error detail | Raw error or stack trace. | |

**User's choice:** Simple error message + try again button

---

| Option | Description | Selected |
|--------|-------------|----------|
| Progress bar + status message | Bar paired with rotating message (e.g., "Finding your topic…"). | ✓ |
| Progress bar only | Just the bar, no text. | |
| Spinning animation, no bar | Indeterminate spinner. | |

**User's choice:** Progress bar + status message (upgraded from bare progress bar)

---

## Deployment Target

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel + Railway (worker + DB) | Vercel for Next.js, Railway for worker and PostgreSQL. | ✓ (modified — Supabase replaces PostgreSQL on Railway) |
| Railway (everything) | Run Next.js, worker, and PostgreSQL all on Railway. | |
| Self-hosted / Docker Compose | Full control, run locally or on a VPS. | |

**User's choice:** Vercel + Railway worker + Supabase (PostgreSQL, Realtime, Storage, Anonymous Auth)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Write directly to PostgreSQL | Worker updates job status in DB, Next.js reads it. | |
| Redis queue + pub/sub | Worker publishes to Redis, Next.js subscribes. | |
| HTTP callbacks to Next.js API | Worker POSTs status updates to an API route. | |

**User's choice:** Free-text — "we will use supabase as our backend"
**Notes:** Supabase replaces the standalone PostgreSQL. Worker writes to Supabase directly. Supabase Realtime handles status push to the frontend.

---

| Supabase feature | Selected |
|-----------------|----------|
| PostgreSQL (database) | ✓ |
| Realtime subscriptions | ✓ |
| Supabase Storage | ✓ |
| Anonymous auth | ✓ |

**User's choice:** All four Supabase features

---

| Option | Description | Selected |
|--------|-------------|----------|
| Railway (worker service) | Dedicated Node.js process, FFmpeg support. | ✓ |
| Fly.io | Similar to Railway — persistent container. | |
| Self-hosted for now | Run worker locally or on VPS for v1. | |

**User's choice:** Railway

**Notes:** User added: "always try to find free apis or services where you can" — cost constraint locked into D-15.

---

## Claude's Discretion

- Exact Prisma schema field names and types for the job model
- Supabase Storage bucket naming and folder structure
- Specific rotating status messages during processing
- Error handling middleware and logging patterns in Next.js API routes
- Worker process structure (polling vs Supabase Realtime trigger for new jobs)

## Deferred Ideas

- Saved job history (requires user accounts — deferred to v2)
- Shareable result links (v1 results are ephemeral — deferred)
- Job retry from the results page (deferred — failure state returns to submission form for now)
