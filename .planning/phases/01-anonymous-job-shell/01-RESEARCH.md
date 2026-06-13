# Phase 1: Anonymous Job Shell - Research

**Researched:** 2026-06-13
**Domain:** Next.js 16 App Router + Supabase (Anonymous Auth, Realtime, PostgreSQL) + Prisma 7 ORM
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Frontend framework — Next.js (full-stack React, App Router).
- **D-02:** Backend structure — Next.js API routes for the web layer + separate Node.js worker process on Railway for all media processing. The worker communicates via Supabase (writes job status directly to the database).
- **D-03:** Database and backend services — Supabase (managed PostgreSQL, Realtime, Storage, Anonymous Auth). Supabase is the single backend infrastructure layer.
- **D-04:** ORM — Prisma for database schema and migrations (works with Supabase PostgreSQL). The `supabase-js` client is used alongside Prisma for Realtime subscriptions, Storage, and Auth.
- **D-05:** Results are ephemeral — deleted on view.
- **D-06:** Users can download results while on the results page before they leave.
- **D-07:** Job ID is not exposed in the URL. Job ID is tracked in the Supabase anonymous auth session (not in the URL or a separate session cookie).
- **D-08:** Anonymous user identity is managed by Supabase Anonymous Auth.
- **D-09:** Status updates use Supabase Realtime subscriptions.
- **D-10:** While processing, the UI shows a progress bar + rotating status message.
- **D-11:** Failure state — plain-language error message + "Try again" button.
- **D-12:** Vercel for the Next.js frontend and API routes.
- **D-13:** Railway for the Node.js worker process.
- **D-14:** Supabase (free tier) for PostgreSQL, Realtime, Storage, and Anonymous Auth.
- **D-15:** Prefer free tiers and free APIs throughout the project.

### Claude's Discretion

- Exact Prisma schema field names and types for the job model.
- Supabase Storage bucket naming and folder structure for artifacts.
- Specific rotating status messages shown during processing.
- Error handling middleware and logging patterns in Next.js API routes.
- Worker process structure (polling Supabase for new jobs, or Supabase Realtime trigger).

### Deferred Ideas (OUT OF SCOPE)

- Saved job history — requires user accounts, deferred to v2.
- Shareable result links — deferred; v1 results are ephemeral and single-viewer.
- Job retry from the results page — for now the failure state just sends the user back to the submission form.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-01 | User can submit a YouTube video URL. | Form validation, YouTube URL regex pattern, Server Action submit flow |
| SUB-02 | User can enter a topic or phrase to search for in the video. | Form text input, Zod validation for min/max length |
| SUB-05 | User can submit a job without creating an account. | Supabase Anonymous Auth, signInAnonymously, is_anonymous JWT claim |
| JOB-01 | User can see processing status after submitting a job. | Supabase Realtime postgres_changes, progress bar + rotating message UI |
| JOB-02 | User can see a clear failure state if any processing step fails. | Job status enum FAILED, human-readable error messages, "Try again" button routing |
</phase_requirements>

---

## Summary

Phase 1 establishes the foundational scaffolding that all subsequent phases extend. It creates the Next.js 16 App Router project, the Supabase backend (with Prisma 7 managing the database schema), the anonymous submission form, and the job-status shell. No real processing happens in this phase — the job is created in a `pending` state and the worker stub simply updates it (or a test harness can flip the status manually for verification).

The most critical design insight for this phase is the **job-ID-in-session pattern**: users have no URL-based job reference. The anonymous Supabase session holds the identity, and a server-side lookup finds the user's active job. This keeps the URL clean but requires careful RLS policy design — every job row must be owned by `auth.uid()` and the Realtime subscription must filter to `user_id=eq.<uid>`.

The second critical insight is the **Next.js 16 breaking change landscape**: Next.js 16 (the current `latest` at v16.2.9) is a significant step from 15. `middleware.ts` is deprecated in favour of `proxy.ts`, all request-time APIs (`cookies()`, `headers()`, `params`, `searchParams`) are fully async, and Prisma 7 requires a `prisma.config.ts` file and a driver adapter — the datasource `url` field is no longer supported in `schema.prisma`.

**Primary recommendation:** Scaffold with `npx create-next-app@latest` (outputs Next.js 16), configure `@supabase/ssr` for cookie-based anonymous auth, Prisma 7 with `@prisma/adapter-pg` and the `prisma.config.ts` pattern, and wire the status page as a client component with a `supabase.channel().on('postgres_changes')` subscription. Do not hand-roll session management, realtime polling, or connection pooling.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Anonymous identity / session | Frontend Server (SSR) | Browser | `signInAnonymously` called server-side on first load; cookie set by `@supabase/ssr` server client |
| Submission form render | Browser / Client | Frontend Server (SSR) | Client component for `useActionState` + `useFormStatus`; page shell server-rendered |
| Job creation on submit | API / Backend | — | Server Action writes job row via Prisma; worker is notified by row insertion |
| Loading overlay / transition | Browser / Client | — | Client state: pending during Server Action, transitions to status page on job ID resolve |
| Job status live updates | Browser / Client | Database / Storage | Supabase Realtime WebSocket in client component subscribes to job row changes |
| Progress bar + messages | Browser / Client | — | Client component cycles message array; driven by Realtime status transitions |
| Failure display | Browser / Client | API / Backend | Client reads `error_message` field from the Realtime payload; "Try again" is a client-side route push |
| Worker job pick-up | API / Backend (Railway) | Database / Storage | Worker polls or subscribes to `pending` jobs via `supabase-js`; out of scope for Phase 1 UI but schema must support it |
| Database schema / migrations | Database / Storage | — | Prisma 7 schema + `prisma migrate dev` against Supabase direct URL |
| Row-level security | Database / Storage | — | Supabase RLS policies enforced in PostgreSQL; never bypassed by the app layer |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.9 | Full-stack React framework, App Router, Server Actions, Route Handlers | Latest stable; Turbopack default; async request APIs required [VERIFIED: npm registry] |
| `react` / `react-dom` | 19.2.7 | UI rendering, Server/Client components | Peer-required by Next.js 16 [VERIFIED: npm registry] |
| `typescript` | 6.0.3 | Static typing throughout | Required by Next.js 16 (min 5.1); project default [VERIFIED: npm registry] |
| `@supabase/supabase-js` | 2.108.1 | Supabase client: Auth, Realtime, Storage | Official Supabase JS SDK [VERIFIED: npm registry] |
| `@supabase/ssr` | 0.12.0 | Cookie-based auth helpers for Next.js App Router SSR | Replaces deprecated `@supabase/auth-helpers-nextjs`; required for `createServerClient` / `createBrowserClient` [VERIFIED: npm registry] |
| `prisma` | 7.8.0 | ORM CLI: schema management, migrations | Official Prisma CLI; v7 requires `prisma.config.ts` pattern [VERIFIED: npm registry] |
| `@prisma/client` | 7.8.0 | Generated database client with full TypeScript types | Peer of `prisma`; driver-adapter-based in v7 [VERIFIED: npm registry] |
| `@prisma/adapter-pg` | 7.8.0 | PostgreSQL driver adapter for Prisma 7 | Required in Prisma 7 — built-in drivers removed [VERIFIED: npm registry] |
| `pg` | 8.21.0 | Node.js PostgreSQL client (used by adapter-pg) | Standard PostgreSQL Node.js driver [VERIFIED: npm registry] |
| `zod` | 4.4.3 | Runtime input validation (form fields, API payloads) | Type-safe schema validation; integrates with Server Actions [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tailwindcss` | 4.3.1 | Utility-first CSS framework | Included in `create-next-app` default template; styling all components [VERIFIED: npm registry] |
| `shadcn` | 4.11.0 | Accessible, unstyled Radix-based component set | Form inputs, buttons, progress bar, loading overlays — saves time on accessible primitives [VERIFIED: npm registry] |
| `vitest` | 4.1.8 | Unit test runner; Vite-native | Official Next.js 16 test recommendation; faster than Jest [VERIFIED: npm registry] |
| `@vitejs/plugin-react` | (latest) | Vitest/Vite React plugin | Required for Vitest to process JSX/TSX | [ASSUMED] |
| `@testing-library/react` | 16.3.2 | Component rendering in unit tests | Pairs with Vitest for Next.js testing [VERIFIED: npm registry] |
| `@testing-library/jest-dom` | 6.9.1 | DOM matchers for Vitest/Jest | Custom matchers like `toBeInTheDocument()` [VERIFIED: npm registry] |
| `vite-tsconfig-paths` | (latest) | Resolve TypeScript path aliases in Vitest | Required when using `@/` aliases in tests | [ASSUMED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma | Drizzle ORM | Drizzle is lighter but lacks the Prisma Studio DX; Prisma's type generation is more mature for team use |
| Supabase Realtime | Client polling | Polling adds load and latency; Realtime is built into Supabase free tier and is the decided approach |
| Server Actions | Route Handlers | Server Actions have built-in CSRF protection and simpler form binding; Route Handlers needed for the worker API endpoint |
| shadcn | Mantine / Chakra UI | shadcn copies source, not a dependency — stays at v0 tree-shaking friendly; no versioning drift |
| Vitest | Jest | Vitest is the official Next.js 16 recommendation; faster startup; same API surface |

### Installation

```bash
# Bootstrap
npx create-next-app@latest clip-that --typescript --tailwind --eslint --app --src-dir

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Prisma 7 + PostgreSQL driver
npm install @prisma/client @prisma/adapter-pg pg
npm install -D prisma

# Validation
npm install zod

# shadcn (CLI initialises components individually)
npx shadcn@latest init

# Testing
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `next` | npm | ~10 yrs | Hundreds of millions/mo | github.com/vercel/next.js | OK | Approved |
| `@supabase/supabase-js` | npm | ~4 yrs | Tens of millions/mo | github.com/supabase/supabase-js | OK | Approved |
| `@supabase/ssr` | npm | ~2 yrs | Millions/mo | github.com/supabase/ssr | OK | Approved |
| `prisma` | npm | ~5 yrs | Hundreds of millions/mo | github.com/prisma/prisma | OK | Approved |
| `@prisma/client` | npm | ~5 yrs | Hundreds of millions/mo | github.com/prisma/prisma | OK | Approved |
| `@prisma/adapter-pg` | npm | ~2 yrs | Millions/mo | github.com/prisma/prisma | OK | Approved |
| `pg` | npm | ~11 yrs | Hundreds of millions/mo | github.com/brianc/node-postgres | OK | Approved |
| `zod` | npm | ~4 yrs | Hundreds of millions/mo | github.com/colinhacks/zod | OK | Approved |
| `tailwindcss` | npm | ~7 yrs | Hundreds of millions/mo | github.com/tailwindlabs/tailwindcss | OK | Approved |
| `shadcn` | npm | ~2 yrs | Millions/mo | github.com/shadcn-ui/ui | OK | Approved |
| `vitest` | npm | ~3 yrs | Hundreds of millions/mo | github.com/vitest-dev/vitest | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious (SUS):** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  |
  | (1) First load — no session
  v
Next.js App (Vercel) — proxy.ts
  |
  | (2) signInAnonymously → Supabase Auth
  |     ← anon JWT cookie set via @supabase/ssr
  |
  | (3) User submits form (YouTube URL + topic)
  |     Server Action:
  |       a. Validate inputs with Zod
  |       b. Prisma: INSERT Job (user_id=auth.uid(), status=PENDING)
  |       ← returns job UUID
  |
  | (4) Client receives job UUID (in-memory only, not URL)
  |     Loading overlay shown
  |     Client Component subscribes to Realtime:
  |       supabase.channel('job:<user_id>')
  |         .on('postgres_changes', { filter: 'user_id=eq.<uid>' })
  |
  |                   Supabase PostgreSQL (jobs table)
  |                         |
  |                         | RLS: user_id = auth.uid()
  |                         |
  |          ← INSERT PENDING job row
  |
  |                   Railway Worker (Phase 2+)
  |                         |
  |                         | Subscribes to PENDING rows
  |                         | Processes → updates status (PROCESSING → DONE/FAILED)
  |
  | (5) Realtime event fires: status changed
  |     Status page shows progress bar + rotating message
  |     On DONE: show download links, schedule artifact deletion
  |     On FAILED: show plain-language error + "Try again" button
  v
Browser (status/result shell)
```

### Recommended Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout — initialises anonymous session
│   ├── page.tsx                # Submission form page (server shell)
│   ├── status/
│   │   └── page.tsx            # Status/result shell (server shell + client component)
│   └── api/
│       └── health/
│           └── route.ts        # Health check for Vercel (GET)
├── components/
│   ├── submission-form.tsx     # 'use client' — form with useActionState
│   ├── status-view.tsx         # 'use client' — Realtime subscription, progress bar
│   └── loading-overlay.tsx     # 'use client' — shown during Server Action pending
├── actions/
│   └── submit-job.ts           # Server Action: validate → create job → return job id
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # createBrowserClient (browser)
│   │   └── server.ts           # createServerClient with cookies() (server)
│   ├── prisma.ts               # PrismaClient singleton with PrismaPg adapter
│   └── youtube.ts              # YouTube URL parsing / video ID extraction
├── types/
│   └── job.ts                  # JobStatus enum mirror, Job type
proxy.ts                        # Renamed from middleware.ts — refreshes Supabase session
prisma/
│   ├── schema.prisma
│   └── migrations/
prisma.config.ts                # Prisma 7 config: direct URL for CLI, pooled for runtime
```

### Pattern 1: Supabase SSR Client Setup (Next.js 16)

**What:** Two client factories — one for server (reads cookies), one for browser (manages cookie via SSR package).
**When to use:** All Supabase interactions in this phase go through one of these two factories.

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies() // cookies() is async in Next.js 16
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

### Pattern 2: proxy.ts (formerly middleware.ts)

**What:** Intercepts every request to refresh the Supabase session cookie. In Next.js 16 this is `proxy.ts` with a `proxy` named export.
**When to use:** Required — without this, server components will see a stale/missing session after the JWT expires.

```typescript
// Source: https://nextjs.org/blog/next-16 (proxy.ts section)
// proxy.ts  (replaces middleware.ts in Next.js 16)
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### Pattern 3: Anonymous Auth on First Visit

**What:** Sign in the user anonymously before they interact. Store the session as a cookie.
**When to use:** Called from the root layout server component (or a layout-level Server Action) on first load when no session exists.

```typescript
// Source: https://supabase.com/docs/guides/auth/auth-anonymous
// In a server component or Server Action:
const supabase = await createClient() // server client
const { data: { user } } = await supabase.auth.getUser()

if (!user) {
  await supabase.auth.signInAnonymously()
}
// The @supabase/ssr setAll() callback persists the cookie automatically
```

### Pattern 4: Prisma 7 Client Singleton with Driver Adapter

**What:** Prisma 7 requires a JavaScript driver adapter. The singleton prevents connection exhaustion in serverless environments.
**When to use:** Import `prisma` from `lib/prisma.ts` in all Server Actions and route handlers.

```typescript
// Source: https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
// lib/prisma.ts
import { PrismaClient } from '../prisma/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!, // pooled connection
})

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

```typescript
// Source: https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
// prisma.config.ts (project root)
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: env('DIRECT_URL'), // direct (non-pooled) for CLI migrations
  },
})
```

### Pattern 5: Prisma Schema — Job Model

**What:** The `Job` table designed to accommodate future phases (transcript, clip plan, artifacts). Status is a Prisma enum.
**When to use:** This schema is created in Phase 1; all future phases extend it with new fields.

```prisma
// Source: Prisma docs + phase requirements analysis [ASSUMED field names]
// prisma/schema.prisma

generator client {
  provider = "prisma-client"
  output   = "./generated/prisma"
}

// Note: datasource url is managed by prisma.config.ts in Prisma 7
datasource db {
  provider = "postgresql"
}

enum JobStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}

model Job {
  id           String    @id @default(uuid())
  userId       String    // = auth.uid() from Supabase Anonymous Auth
  youtubeUrl   String
  topic        String
  status       JobStatus @default(PENDING)
  errorMessage String?   // human-readable, set by worker on FAILED
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([userId])    // for RLS-filtered Realtime queries
}
```

### Pattern 6: Supabase RLS Policies for Job Ownership

**What:** Every database operation (SELECT, INSERT, UPDATE) on `jobs` is gated to the owning anonymous user.
**When to use:** Applied as part of the migration. Required before enabling Realtime on the table.

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- Enable RLS
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;

-- Allow a user to see only their own jobs
CREATE POLICY "Users can view their own jobs"
ON "Job" FOR SELECT
USING ((select auth.uid())::text = "userId");

-- Allow authenticated (including anonymous) users to insert jobs with their own userId
CREATE POLICY "Users can insert their own jobs"
ON "Job" FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid())::text = "userId");

-- Allow workers to update any job (worker uses service-role key — bypasses RLS)
-- No UPDATE policy needed for anon users in v1
```

### Pattern 7: Supabase Realtime Subscription in Client Component

**What:** Client component subscribes to changes on the user's job row. Drives the progress bar and status transitions.
**When to use:** Status page client component, mounted after the job is created and the user is routed to the status view.

```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes
// components/status-view.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function StatusView({ userId }: { userId: string }) {
  const [status, setStatus] = useState<string>('PENDING')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`job-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Job',
          filter: `userId=eq.${userId}`,
        },
        (payload) => {
          setStatus(payload.new.status)
          setErrorMessage(payload.new.errorMessage ?? null)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // render progress bar / status message / error state based on `status`
}
```

**Required Supabase dashboard setup:**
1. Go to Database > Replication > supabase_realtime publication
2. Enable the `Job` table for replication

### Pattern 8: Server Action — Submit Job

**What:** Validates the form, ensures the user has an anonymous session, creates the job row, and returns the job ID in-memory to the client.
**When to use:** Called from `<form action={submitJob}>` in the submission form client component.

```typescript
// Source: https://nextjs.org/docs/app/guides/forms [ASSUMED structure]
// actions/submit-job.ts
'use server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  youtubeUrl: z.string().url().refine(isYouTubeUrl, 'Must be a YouTube URL'),
  topic: z.string().min(2).max(200),
})

export async function submitJob(
  _prevState: unknown,
  formData: FormData
) {
  const result = schema.safeParse({
    youtubeUrl: formData.get('youtubeUrl'),
    topic: formData.get('topic'),
  })

  if (!result.success) {
    return { error: result.error.flatten() }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'No session — please refresh and try again.' }
  }

  const job = await prisma.job.create({
    data: {
      userId: user.id,
      youtubeUrl: result.data.youtubeUrl,
      topic: result.data.topic,
      status: 'PENDING',
    },
  })

  return { jobId: job.id }
}
```

### Anti-Patterns to Avoid

- **Storing the job ID in the URL:** The job ID in the URL breaks the security model and exposes it to browser history. Use the Supabase session as the sole identity link (D-07).
- **Using `middleware.ts` in Next.js 16:** It is deprecated. Use `proxy.ts` with `export function proxy(...)`. Failing to do this will generate deprecation warnings and break in a future minor.
- **Putting `url` in `datasource db {}` in `schema.prisma`:** Prisma 7 removed support for this. Use `prisma.config.ts` instead.
- **Using synchronous `cookies()` or `headers()`:** Next.js 16 fully removed sync access. Always `await cookies()`, `await headers()`.
- **Calling `supabase.auth.signInAnonymously()` on every server request:** Call it once on first visit, then rely on the cookie. Idempotent check: `if (!user) { await signInAnonymously() }`.
- **Not enabling RLS on the jobs table before enabling Realtime:** Without RLS, any authenticated user can see any job row via Realtime — a direct data leak.
- **Using `supabase.auth.getSession()` for server-side auth:** Use `getUser()` — it makes a network call to validate the token. `getSession()` trusts the cookie value without revalidation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Anonymous session management | Custom session token generation + storage | Supabase Anonymous Auth (`signInAnonymously`) | JWT lifecycle, refresh, cookie management all handled; RLS policies use `auth.uid()` automatically |
| Cookie-based SSR auth in Next.js | Custom cookie middleware | `@supabase/ssr` createServerClient / createBrowserClient | Handles token refresh across server/client boundary; keeps session in sync |
| Real-time status polling | `setInterval` + API route | Supabase Realtime `postgres_changes` | WebSocket-based; no polling overhead; built into Supabase free tier |
| Database connection pooling | Custom pg pool configuration | Supabase Supavisor + `prisma.config.ts` `DIRECT_URL` / `DATABASE_URL` split | Connection exhaustion is the #1 serverless PostgreSQL failure mode; Supavisor handles multiplexing |
| Input validation | Manual regex / conditional checks | Zod `schema.safeParse()` | Type-safe parse; structured errors; reuse between server and client |
| YouTube URL validation | Complex custom regex | Simple regex for `watch?v=`, `youtu.be/`, `shorts/` formats (well-known patterns) + video ID length check | [ASSUMED] A short-but-sufficient regex covers 99% of cases; no npm package needed for this use case |
| Form loading state | Manual `useState(false)` + `fetch()` | `useActionState` + `useFormStatus` | Built-in to React 19 / Next.js 16; CSRF protection included in Server Actions |
| ORM migrations | Raw SQL migration files | `prisma migrate dev` | Handles shadow database, checksums, and the Prisma schema as source of truth |

**Key insight:** The Supabase + Prisma 7 combination covers all backend concerns (auth, realtime, migrations, connection pooling) without custom infrastructure. The only surface-level code needed is schema declaration and RLS SQL.

---

## Common Pitfalls

### Pitfall 1: Supabase Caching Anonymous Sessions in Next.js Static Rendering

**What goes wrong:** Multiple concurrent users share the same anonymous session because Next.js statically rendered (cached) the page with a stale session result.
**Why it happens:** The Supabase team has confirmed reports of user metadata being cached across unique anonymous users as a result of Next.js static page rendering.
**How to avoid:** Pages that call `supabase.auth.getUser()` or `signInAnonymously()` must use **dynamic rendering**. Add `export const dynamic = 'force-dynamic'` to any layout or page that invokes auth functions. The `proxy.ts` approach forces dynamic rendering naturally for SSR routes, but explicitly set this on the root layout.
**Warning signs:** Different browser tabs in the same incognito window share the same `user.id`.

### Pitfall 2: Prisma 7 Schema.prisma datasource url field Removed

**What goes wrong:** `prisma migrate dev` fails or Prisma Client cannot connect because `url` is specified in `datasource db {}` in `schema.prisma`.
**Why it happens:** Prisma 7 moved all datasource URL configuration to `prisma.config.ts`. The `url` and `directUrl` fields in `schema.prisma` datasource block are no longer supported.
**How to avoid:** Use `prisma.config.ts` for the `DIRECT_URL` (migrations) and set `DATABASE_URL` (pooled) for the driver adapter instantiation at runtime.
**Warning signs:** Error `Unknown field 'url' in datasource block` on `prisma generate`.

### Pitfall 3: Next.js 16 Sync Request API Access

**What goes wrong:** Build fails or runtime error thrown when accessing `cookies()`, `headers()`, `params`, or `searchParams` without `await`.
**Why it happens:** Next.js 16 fully removed the synchronous compatibility layer from v15. These are now full Promises.
**How to avoid:** Always `await cookies()`, `await headers()`, and `await props.params` / `await props.searchParams` in any server component or route handler.
**Warning signs:** TypeScript error `Type 'Promise<...>' is not assignable to type '...'` on params/searchParams usage.

### Pitfall 4: Realtime Without RLS Enabled — Data Leak

**What goes wrong:** The Realtime subscription returns rows for all users, not just the subscribing user.
**Why it happens:** Supabase Realtime respects RLS only when RLS is enabled on the table AND the table is added to the realtime publication. If RLS is off, all rows are visible to all authenticated connections.
**How to avoid:** Enable RLS on `Job` before running the migration; add the table to the `supabase_realtime` publication; use a `filter: 'userId=eq.<uid>'` in the subscription.
**Warning signs:** Subscription receives UPDATE events for jobs owned by other user IDs.

### Pitfall 5: Job ID Leaked via Client State

**What goes wrong:** The job ID is placed in localStorage, sessionStorage, or a query param during the loading overlay state.
**Why it happens:** The path of least resistance for "persist this across a page transition" is `router.push('/status?jobId=...')`. This conflicts with D-07.
**How to avoid:** The job ID lives only in React state (`useActionState` return value) during the loading overlay; after the Server Action resolves, the status page is reached via a `router.push('/status')` — the status page fetches the user's active job from the database using `auth.uid()` server-side. The job ID is never in the URL or local storage.
**Warning signs:** Browser Network tab shows `/status?jobId=` or `/status#...` with a UUID visible.

### Pitfall 6: Using `getSession()` for Server-Side Auth

**What goes wrong:** A malicious user crafts a fake JWT cookie and bypasses auth.
**Why it happens:** `supabase.auth.getSession()` trusts the cookie's JWT without re-validating with the Supabase Auth server.
**How to avoid:** Always use `supabase.auth.getUser()` on the server. It makes a network call to validate the token.
**Warning signs:** Using `getSession()` in any server component, Server Action, or Route Handler.

### Pitfall 7: Supabase Anonymous Auth Abuse Without Rate Limiting

**What goes wrong:** Database fills with millions of anonymous user records; Supabase free-tier limits hit.
**Why it happens:** `signInAnonymously()` is an open endpoint. Each call creates a persistent user record.
**How to avoid:** The 30 req/hour IP rate limit provides baseline protection. For Phase 1 MVP, accept this limit. If abuse becomes a concern in later phases, enable Cloudflare Turnstile CAPTCHA in Supabase Auth dashboard (free tier available).
**Warning signs:** `auth.users` table row count grows rapidly without matching job submissions.

---

## Code Examples

### YouTube URL Validation Utility

```typescript
// Source: labnol.org/code/19797-regex-youtube-id + common patterns [ASSUMED — training knowledge]
// lib/youtube.ts

const YOUTUBE_REGEX =
  /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX)
  return match ? match[1] : null
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null
}
```

### Supabase Realtime — Enable Table Replication (SQL)

```sql
-- Source: https://supabase.com/docs/guides/realtime/postgres-changes
-- Run via Supabase SQL editor or migration file:
ALTER PUBLICATION supabase_realtime ADD TABLE "Job";
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<key>
# Server-only:
DATABASE_URL=postgres://postgres.<project>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

**Note:** The legacy `anon` key is being deprecated by Supabase by end of 2026. Use `sb_publishable_*` keys when creating new projects.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` + `export default function middleware()` | `proxy.ts` + `export function proxy()` | Next.js 16 (Oct 2025) | Must rename file and export; `middleware.ts` is deprecated |
| Sync `cookies()`, `headers()`, `params` | `await cookies()`, `await headers()`, `await props.params` | Next.js 16 (removed sync compat from v15) | Build-time type errors if sync access used |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` with `createServerClient` / `createBrowserClient` | Supabase SSR package (~2023, stable 2024) | Old helpers deprecated; SSR package is the only supported pattern |
| Prisma schema `datasource db { url = env("DATABASE_URL") }` | `prisma.config.ts` datasource config, no url in schema | Prisma 7 (2025) | Hard break — schema url field removed entirely |
| Prisma built-in query engine | Prisma driver adapters (`@prisma/adapter-pg`) | Prisma 7 (2025) | Adapter is now required; opt-in becomes mandatory |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 2026 | Legacy `anon` key deprecated by end of 2026 |
| Implicit Next.js caching (fetch cache) | Explicit `"use cache"` directive / `cacheComponents: true` | Next.js 16 (Oct 2025) | All routes dynamic by default; opt-in caching is cleaner |

**Deprecated / outdated to avoid:**
- `@supabase/auth-helpers-nextjs` — deprecated; use `@supabase/ssr`
- `getSession()` on server — insecure; use `getUser()`
- `middleware.ts` named export `middleware` — deprecated in Next.js 16; use `proxy.ts` / `proxy`
- `prisma-client-js` generator provider — removed in Prisma 7; use `prisma-client`
- `datasource db { url = ... }` in `schema.prisma` — removed in Prisma 7; use `prisma.config.ts`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | YouTube URL regex pattern covers all major URL formats (`watch?v=`, `youtu.be/`, `shorts/`, `embed/`) | Code Examples / Don't Hand-Roll | Wrong regex could silently accept invalid URLs or reject valid ones; low risk as the video ID extraction is robust |
| A2 | Exact Prisma schema field names (`youtubeUrl`, `userId`, `errorMessage`, etc.) | Pattern 5 | Field names are at Claude's discretion per CONTEXT.md; planner should confirm casing convention (camelCase vs snake_case) |
| A3 | Worker in Phase 1 is a stub (no real processing); the plan should include a way to manually flip job status for testing | Architecture | If the plan assumes real worker integration in Phase 1, it will over-scope the phase |
| A4 | `@vitejs/plugin-react` and `vite-tsconfig-paths` versions in "Supporting" table | Standard Stack | Minor version drift; install via `npm install -D` will resolve latest compatible |
| A5 | Supabase free tier Realtime limits are sufficient for development and early production | Architecture | Free tier supports 200 concurrent Realtime connections; adequate for Phase 1 MVP but may need monitoring |

---

## Open Questions (RESOLVED)

1. **Worker Trigger Mechanism (Claude's Discretion)**
   - What we know: The worker runs on Railway; it must know when a new PENDING job exists.
   - What's unclear: Should the worker (a) poll Supabase every N seconds for PENDING rows, or (b) subscribe to Supabase Realtime for INSERT events on the Job table?
   - Recommendation: Use polling in Phase 1 (simpler, no WebSocket dependency on the worker side); upgrade to Realtime subscription in Phase 2 when the worker is doing real work. The schema stub in Phase 1 does not need to encode this choice.

2. **Anonymous Session Lifecycle on Status Page**
   - What we know: The anonymous session is stored in a cookie managed by `@supabase/ssr`.
   - What's unclear: What happens if the user closes and reopens the browser before the job completes? The cookie persists but the status page must re-fetch the user's active job on load.
   - Recommendation: The status page should always call `getUser()` server-side, then look up `Job WHERE userId = user.id AND status NOT IN (DONE, FAILED)` to find the active job. This is resilient to page reloads.

3. **Supabase Realtime Filter — Column Name Casing**
   - What we know: The filter syntax is `column=eq.value`. The column name must match the PostgreSQL column name exactly.
   - What's unclear: Prisma's PostgreSQL output uses double-quoted camelCase column names by default (e.g., `"userId"`). The Realtime filter must use the actual column name in PostgreSQL.
   - Recommendation: Verify the actual PostgreSQL column names after running `prisma migrate dev` (`\d "Job"` in psql), and use those exact names in the Realtime filter string.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20.9+ | Next.js 16 minimum requirement | ✓ | 22.19.0 | — |
| npm | Package installation | ✓ | 11.16.0 | — |
| Supabase project (free tier) | All backend operations | Must be created | — | Cannot proceed without Supabase project |
| Vercel account | Next.js deployment | Must be created | — | Local dev works without Vercel |
| Railway account | Node.js worker (Phase 2+) | Not needed in Phase 1 | — | Not needed for Phase 1 shell |

**Missing dependencies with no fallback:**
- Supabase project must be created before `npm run dev` can connect to a database. Steps: create project at supabase.com → copy connection strings → add to `.env.local`.

**Missing dependencies with fallback:**
- Vercel account: Not required for Phase 1 development. `npm run dev` runs locally. Vercel deployment is verified in the phase gate, not during plan execution.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 + React Testing Library 16.3.2 |
| Config file | `vitest.config.mts` — Wave 0 gap |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUB-01 | YouTube URL validation rejects non-YouTube URLs | unit | `npm test -- --run src/__tests__/youtube.test.ts` | Wave 0 gap |
| SUB-01 | YouTube URL validation accepts all YouTube URL formats | unit | `npm test -- --run src/__tests__/youtube.test.ts` | Wave 0 gap |
| SUB-02 | Topic field requires minimum 2 characters | unit | `npm test -- --run src/__tests__/submit-job.test.ts` | Wave 0 gap |
| SUB-05 | Anonymous session established before job creation | integration (manual) | Manual: open browser, submit form, check Supabase dashboard | N/A |
| JOB-01 | Status page renders progress bar and status message | unit | `npm test -- --run src/__tests__/status-view.test.tsx` | Wave 0 gap |
| JOB-02 | Failed job shows error message and "Try again" button | unit | `npm test -- --run src/__tests__/status-view.test.tsx` | Wave 0 gap |

**Note:** Async Server Components (layout, page) cannot be unit-tested with Vitest. Test client components (`submission-form.tsx`, `status-view.tsx`) and pure utility functions (`lib/youtube.ts`, Zod schema in `actions/submit-job.ts`).

### Sampling Rate

- **Per task commit:** `npm test -- --run` (watch off, single pass)
- **Per wave merge:** `npm test -- --run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.mts` — Vitest configuration
- [ ] `src/__tests__/youtube.test.ts` — covers SUB-01 YouTube URL parsing
- [ ] `src/__tests__/submit-job.test.ts` — covers SUB-01, SUB-02 Zod validation
- [ ] `src/__tests__/status-view.test.tsx` — covers JOB-01, JOB-02 status rendering
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths`

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Anonymous Auth — `signInAnonymously`; validate with `getUser()` server-side, never `getSession()` |
| V3 Session Management | Yes | `@supabase/ssr` cookie-based session; HttpOnly cookies set by Supabase; refreshed via `proxy.ts` |
| V4 Access Control | Yes | Supabase RLS policies: `user_id = auth.uid()` on Job table; worker uses service-role key (bypasses RLS safely on server-only infra) |
| V5 Input Validation | Yes | Zod schema on `submitJob` Server Action: URL format, topic min/max length; validated server-side before DB write |
| V6 Cryptography | No | No custom cryptography; Supabase handles JWT signing |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anonymous auth abuse (database flooding) | Denial of Service | Supabase IP rate limit (30/hr); Cloudflare Turnstile CAPTCHA optional in dashboard |
| Session fixation / JWT forgery | Spoofing | Always `getUser()` not `getSession()` on server; Supabase JWT signed with project secret |
| Job ID enumeration (IDOR) | Information Disclosure | Job ID not in URL (D-07); RLS enforces `user_id = auth.uid()` on all reads |
| XSS via error message display | Tampering | React's built-in JSX escaping; never use `dangerouslySetInnerHTML` for error strings |
| CSRF on form submission | Tampering | Next.js Server Actions have built-in CSRF protection (encrypted origin check) |
| Supabase service-role key leak | Elevation of Privilege | Service-role key used only on Railway worker (server-only); never set as `NEXT_PUBLIC_*` |

---

## Sources

### Primary (HIGH confidence)

- [Next.js 16 Blog](https://nextjs.org/blog/next-16) — `proxy.ts`, breaking changes, async request APIs, caching model
- [Next.js Upgrade Guide v16](https://nextjs.org/docs/app/guides/upgrading/version-16) — Complete breaking changes table, async param migration
- [Supabase Anonymous Auth Docs](https://supabase.com/docs/guides/auth/auth-anonymous) — `signInAnonymously`, `is_anonymous`, rate limits, CAPTCHA
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — `auth.uid()` policy patterns, INSERT/SELECT policy examples
- [Supabase Realtime Postgres Changes Docs](https://supabase.com/docs/guides/realtime/postgres-changes) — subscription setup, filter syntax, RLS requirements
- [Prisma Upgrade v7 Guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) — `prisma.config.ts`, generator change, driver adapter requirement
- [Next.js Vitest Testing Guide](https://nextjs.org/docs/app/guides/testing/vitest) — official Vitest setup for Next.js 16 App Router
- npm registry — all package versions verified via `npm view <pkg> version`

### Secondary (MEDIUM confidence)

- [Prisma Supabase Docs](https://www.prisma.io/docs/orm/v6/overview/databases/supabase) — DATABASE_URL / DIRECT_URL pattern for Supabase connection pooling
- [Supabase SSR Client Setup](https://supabase.com/docs/guides/auth/server-side/nextjs) — createBrowserClient / createServerClient pattern
- [Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) — decision guidance for form submission pattern

### Tertiary (LOW confidence)

- Community articles on Prisma 7 + Supabase integration patterns (DEV Community, Medium) — corroborate official docs
- YouTube URL regex patterns — well-known community-maintained regex, marked [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all versions verified via `npm view` on registry; major version changes documented from official sources
- Architecture: HIGH — patterns derived from official Next.js 16, Supabase, and Prisma 7 documentation
- Pitfalls: HIGH — sourced directly from official changelogs and documented breaking changes
- Validation Architecture: MEDIUM — Vitest setup from official docs; specific test file structures are recommended patterns, not mandated

**Research date:** 2026-06-13
**Valid until:** 2026-09-13 (90 days — Next.js 16.x is stable; Prisma 7.x and Supabase SSR 0.12.x are stable)
