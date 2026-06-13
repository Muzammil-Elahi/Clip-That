# Walking Skeleton — Clip-That

**Phase:** 1
**Generated:** 2026-06-13

## Capability Proven End-to-End

An anonymous user can submit a YouTube URL and topic on the submission page, have a job row written to Supabase PostgreSQL, and be served a status page that reads that job row back from the database.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.9 App Router (full-stack, SSR + Server Actions) | Per D-01; Vercel-native, integrates seamlessly with Supabase SSR auth helpers; App Router gives co-located Server Actions for form submission |
| Data layer | Supabase PostgreSQL + Prisma 7.8.0 ORM + `@prisma/adapter-pg` | Per D-03, D-04; Prisma 7 manages schema and migrations via `prisma.config.ts`; Supabase Supavisor handles connection pooling in serverless |
| Auth | Supabase Anonymous Auth (`signInAnonymously`) via `@supabase/ssr` cookie-based session | Per D-08; zero-friction for users; JWT stored in HttpOnly cookie; identity linked to job rows via RLS; no account required |
| Deployment target | Vercel (Next.js web app) + Railway (Node.js worker, Phase 2+) | Per D-12, D-13; Vercel is the natural Next.js deployment target; Railway provides persistent compute for FFmpeg work |
| Directory layout | `src/app/` App Router pages; `src/components/` client components; `src/actions/` server actions; `src/lib/` utilities (supabase, prisma, youtube); `src/types/` shared types; `prisma/` schema + migrations; `prisma.config.ts` at root |
| CSS / design system | Tailwind CSS 4.3.1 + shadcn (Radix-based component source copies) | Per RESEARCH.md standard stack; shadcn copies source into `src/components/ui/` — no versioning drift; Radix provides accessible primitives |
| Test runner | Vitest 4.1.8 + React Testing Library 16.3.2 | Per RESEARCH.md; official Next.js 16 recommendation; faster than Jest; same API surface |
| Session/routing convention | `proxy.ts` (Next.js 16 replacement for `middleware.ts`) refreshes Supabase session cookie on every request | Required by Next.js 16 (middleware.ts deprecated); ensures server components see fresh session |

## Stack Touched in Phase 1

- [x] Project scaffold (Next.js 16, TypeScript, Tailwind, ESLint, Vitest)
- [x] Routing — `/` (submission) and `/status` (job status shell)
- [x] Database — job INSERT (Server Action) + job SELECT (status page server component)
- [x] UI — submission form wired to Server Action; status page client component with Supabase Realtime subscription
- [x] Deployment — `npm run dev` exercises the full stack locally; Vercel deployment verified manually at phase gate

## Out of Scope (Deferred to Later Slices)

- Transcript retrieval and YouTube API calls (Phase 2)
- Video processing, FFmpeg, stitching (Phase 4)
- Study notes and PDF generation (Phase 5)
- Semantic matching (Phase 6)
- Railway worker deployment (Phase 2+)
- Saved job history and user accounts (v2)
- Shareable result links (v2, deferred)
- Job retry from the results page (v2, deferred)
- Artifact download links (Phase 4, when real artifacts exist)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: System retrieves YouTube transcript and finds exact topic matches — extends Job with transcript + clip plan data
- Phase 3: System builds context windows and produces the stitched transcript view
- Phase 4: System extracts and stitches video segments; user can play the result
- Phase 5: System generates study notes; user can download a PDF
- Phase 6: User can enable semantic matching before submitting
