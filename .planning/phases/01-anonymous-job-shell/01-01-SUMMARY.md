---
phase: 01-anonymous-job-shell
plan: 01
subsystem: infra
tags: [nextjs, supabase, prisma, zod, vitest, tailwind, shadcn, typescript, postgresql]

# Dependency graph
requires: []
provides:
  - Next.js 16.2.9 App Router project scaffold with TypeScript 5, Tailwind 4, ESLint
  - Supabase anonymous auth wired via @supabase/ssr (server + browser clients)
  - Prisma 7 Job model with JobStatus enum, driver adapter, global singleton
  - submitJob Server Action with Zod validation and Prisma job creation
  - YouTube URL validation utility (extractYouTubeVideoId, isYouTubeUrl)
  - Vitest 4 test infrastructure with 20 passing unit tests
  - shadcn component library (Nova preset) with Button, Input, Label, Progress, Card, Alert
  - Health check endpoint at /api/health
  - proxy.ts session refresh (Next.js 16 replacement for middleware.ts)
affects:
  - 01-02 (submission form uses submitJob, Supabase clients, shadcn components)
  - 01-03 (status view uses Supabase Realtime, Job type, prisma singleton)
  - all future phases (extend Job model via Prisma schema)

# Tech tracking
tech-stack:
  added:
    - next@16.2.9
    - react@19.2.4
    - typescript@5
    - tailwindcss@4
    - "@supabase/supabase-js@2.108.1"
    - "@supabase/ssr@0.12.0"
    - prisma@7.8.0
    - "@prisma/client@7.8.0"
    - "@prisma/adapter-pg@7.8.0"
    - pg@8.21.0
    - zod@4.4.3
    - vitest@4.1.8
    - "@testing-library/react@16.3.2"
    - "@testing-library/jest-dom@6.9.1"
    - shadcn@4.11.0
    - lucide-react
    - dotenv (devDependency, for prisma.config.ts .env.local loading)
  patterns:
    - Prisma 7 driver-adapter pattern (no url in datasource block)
    - Supabase @supabase/ssr createServerClient / createBrowserClient split
    - Next.js 16 async cookies() (await required in server components)
    - proxy.ts session refresh (Next.js 16 replacement for middleware.ts)
    - Global PrismaClient singleton (prevents connection exhaustion in serverless)
    - force-dynamic on root layout (prevents session caching across anonymous users)
    - getUser() always over getSession() on server (network-validated, T-01-01)

key-files:
  created:
    - prisma/schema.prisma
    - prisma.config.ts
    - proxy.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/lib/prisma.ts
    - src/lib/youtube.ts
    - src/lib/utils.ts
    - src/types/job.ts
    - src/actions/submit-job.ts
    - src/app/layout.tsx
    - src/app/api/health/route.ts
    - src/__tests__/setup.ts
    - src/__tests__/youtube.test.ts
    - src/__tests__/submit-job.test.ts
    - vitest.config.mts
    - package.json
    - .gitignore
    - components.json
    - src/components/ui/button.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
    - src/components/ui/progress.tsx
    - src/components/ui/card.tsx
    - src/components/ui/alert.tsx
  modified:
    - src/app/layout.tsx (force-dynamic + signInAnonymously)
    - package.json (test scripts added, name fixed)

key-decisions:
  - "YOUTUBE_REGEX extended with 'shorts' alternative to cover /shorts/ URL format"
  - "prisma.config.ts imports dotenv to load .env.local (Prisma does not read .env.local natively)"
  - "Prisma generated client output path is prisma/generated/prisma; import uses ../../prisma/generated/prisma/client"
  - "shadcn Nova preset selected (Lucide icons + Geist font, matches UI-SPEC)"
  - "prisma/generated/ added to .gitignore (regenerated on prisma generate)"

patterns-established:
  - "Pattern: Server Supabase client = await createClient() from @/lib/supabase/server"
  - "Pattern: Browser Supabase client = createClient() from @/lib/supabase/client"
  - "Pattern: DB access = import { prisma } from @/lib/prisma (singleton)"
  - "Pattern: Form validation = submitJobSchema.safeParse() before any DB write"
  - "Pattern: Server auth = supabase.auth.getUser() (never getSession())"

requirements-completed: [SUB-01, SUB-02, SUB-05, JOB-01, JOB-02]

# Metrics
duration: 35min
completed: 2026-06-13
---

# Phase 01 Plan 01: Anonymous Job Shell — Scaffold Summary

**Next.js 16 + Supabase anonymous auth + Prisma 7 Job model walking skeleton with 20 passing Vitest unit tests and Zod-validated submitJob Server Action**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-13T22:00:00Z
- **Completed:** 2026-06-13T22:10:00Z
- **Tasks:** 2 (Task 1 was human checkpoint; Task 2 executed here)
- **Files modified:** 42

## Accomplishments

- Full Next.js 16.2.9 project scaffolded from create-next-app with TypeScript, Tailwind 4, App Router
- Supabase SSR wired: server client (async cookies) + browser client + proxy.ts session refresh
- Prisma 7 Job model created with JobStatus enum and @@index([userId]); driver adapter pattern established
- submitJob Server Action exports Zod schema + full validation flow (URL check + anonymous auth + DB write)
- YouTube URL utility (extractYouTubeVideoId, isYouTubeUrl) covers watch?v=, youtu.be/, shorts/, embed/ formats
- shadcn Nova preset initialized with Button, Input, Label, Progress, Card, Alert components
- Vitest 4 configured with jsdom + React Testing Library + @testing-library/jest-dom; all 20 tests pass
- Health check route GET /api/health returns {"status":"ok"} with HTTP 200
- npm run build exits 0 with no TypeScript errors

## Task Commits

1. **Task 1: Create Supabase project** — completed as human checkpoint (no code commit)
2. **Task 2: Scaffold full stack** — `3b669e9` (feat)

## Files Created/Modified

- `prisma/schema.prisma` — Job model + JobStatus enum, Prisma 7 schema (no datasource url)
- `prisma.config.ts` — Prisma 7 config with dotenv .env.local loader + DIRECT_URL for migrations
- `proxy.ts` — Next.js 16 session refresh proxy (replaces deprecated middleware.ts)
- `src/lib/supabase/server.ts` — async createServerClient with getAll/setAll cookie handlers
- `src/lib/supabase/client.ts` — createBrowserClient factory
- `src/lib/prisma.ts` — PrismaClient + PrismaPg adapter global singleton
- `src/lib/youtube.ts` — YOUTUBE_REGEX, extractYouTubeVideoId, isYouTubeUrl
- `src/types/job.ts` — JobStatus enum + Job interface (client-side mirrors)
- `src/actions/submit-job.ts` — submitJobSchema (exported) + submitJob Server Action
- `src/app/layout.tsx` — force-dynamic + signInAnonymously on first visit
- `src/app/api/health/route.ts` — GET handler returning {status: 'ok'}
- `vitest.config.mts` — Vitest config (jsdom, React plugin, tsconfigPaths, globals)
- `src/__tests__/setup.ts` — @testing-library/jest-dom import
- `src/__tests__/youtube.test.ts` — 12 tests for YouTube URL parsing
- `src/__tests__/submit-job.test.ts` — 8 tests for Zod schema validation
- `src/components/ui/` — button, input, label, progress, card, alert (shadcn)

## Decisions Made

- Used `dotenv` in `prisma.config.ts` to load `.env.local` since Prisma 7 does not automatically read Next.js `.env.local` files.
- Added `prisma/generated/` to `.gitignore` — Prisma client is regenerated on `prisma generate`, no need to commit generated code.
- Fixed `YOUTUBE_REGEX` to add `shorts` as an alternative in the path-based group so that `/shorts/<id>` URLs resolve correctly (training data regex was incomplete for this format).
- Used shadcn Nova preset (Lucide icons + Geist font) which aligns with UI-SPEC design system specification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed YOUTUBE_REGEX missing /shorts/ support**
- **Found during:** Task 2 (unit tests for youtube.test.ts — RED phase)
- **Issue:** The YOUTUBE_REGEX from RESEARCH.md `[^/\n\s]+\/\S+\/` required two path segments before the ID, but `/shorts/dQw4w9WgXcQ` has only one. Two test cases failed.
- **Fix:** Added `shorts` as an alternative alongside `v`, `e(?:mbed)?` in the path-based group: `(?:v|e(?:mbed)?|shorts)\/`
- **Files modified:** `src/lib/youtube.ts`
- **Verification:** All 12 youtube.test.ts tests pass including shorts URL formats.
- **Committed in:** `3b669e9` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Prisma import path in src/lib/prisma.ts**
- **Found during:** Task 2 (unit tests for submit-job.test.ts)
- **Issue:** Import path was `../prisma/generated/prisma/client` but the actual path from `src/lib/` is `../../prisma/generated/prisma/client` (one extra level up needed).
- **Fix:** Changed import to use `../../prisma/generated/prisma/client`
- **Files modified:** `src/lib/prisma.ts`
- **Verification:** All 8 submit-job.test.ts tests pass.
- **Committed in:** `3b669e9` (Task 2 commit)

**3. [Env Constraint] prisma migrate dev failed due to IPv6-only direct connection**
- **Found during:** Task 2 (migration step)
- **Issue:** `DIRECT_URL` resolves to an IPv6 address (`db.hztmgigblclcofvbtzte.supabase.co → 2600:1f14:...`) which is not reachable from the execution environment. The session-mode pooler (`aws-0-*.pooler.supabase.com:5432`) IS reachable.
- **Fix applied:** Documented as user setup required. Migration must be run manually OR the DIRECT_URL updated to the session-mode pooler URL. All schema and config files are correct — only the network execution environment is the constraint.
- **Files modified:** None (config is correct)
- **Impact:** Job table does not yet exist in Supabase; RLS policies and Realtime setup also pending.

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs), 1 documented environment constraint
**Impact on plan:** Auto-fixes required for correctness. Environment constraint (migration) is a one-time setup step the user must run in their own terminal.

## Known Stubs

- `src/app/page.tsx` — still shows create-next-app default content. The actual submission form UI is built in Plan 01-02.
- Prisma Job table does not exist in Supabase yet — pending manual migration (see User Setup Required section).

## Threat Flags

No new threat surface beyond what was already modeled in the plan's threat model.

## Issues Encountered

- **create-next-app naming restriction:** `npx create-next-app@latest .` fails with "name can no longer contain capital letters" when the directory name is `Clip-That`. Scaffolded to `clip-that-temp` and used PowerShell `Copy-Item` to move files across.
- **IPv6-only Supabase direct connection:** `prisma migrate dev` cannot reach `db.hztmgigblclcofvbtzte.supabase.co:5432` from this environment (resolves to IPv6 only). The transaction-mode pooler port 6543 and session-mode pooler port 5432 both work.

## User Setup Required

The following manual steps are required before running the app end-to-end:

### 1. Run Prisma migration

From your own terminal in the project directory:

```bash
npx prisma migrate dev --name init
```

If this fails with a connection error, update `DIRECT_URL` in `.env.local` to use the **session-mode pooler** connection string from Supabase:

- Go to Project Settings → Database → Connection string
- Select "Session mode" (port 5432) — this is different from "Transaction mode" (port 6543)
- Replace DIRECT_URL with that connection string

### 2. Apply RLS policies in Supabase SQL editor

Go to your Supabase project → SQL Editor and run:

```sql
-- Enable RLS
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;

-- Allow users to see only their own jobs
CREATE POLICY "Users can view their own jobs"
ON "Job" FOR SELECT
USING ((select auth.uid())::text = "userId");

-- Allow authenticated (including anonymous) users to insert their own jobs
CREATE POLICY "Users can insert their own jobs"
ON "Job" FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid())::text = "userId");
```

### 3. Enable Realtime on Job table

In the SQL editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE "Job";
```

Or via Dashboard → Database → Replication → supabase_realtime → enable the Job table.

## Next Phase Readiness

- Next.js 16 project runs locally (`npm run dev`)
- All unit tests pass (`npm run test:run` — 20/20)
- Build succeeds (`npm run build` exits 0)
- Supabase auth, Prisma, and Server Action code are all wired and ready
- **Blocker:** Prisma migration must be completed before the submitJob Server Action can write to the database
- Plan 01-02 (submission form UI) can be scaffolded in parallel with the migration

---
*Phase: 01-anonymous-job-shell*
*Completed: 2026-06-13*

## Self-Check: PASSED

- [x] `prisma/schema.prisma` exists with `model Job`
- [x] `prisma.config.ts` exists with `defineConfig`
- [x] `proxy.ts` exists with `export async function proxy`
- [x] `src/lib/supabase/server.ts` contains `createServerClient` and `await cookies()`
- [x] `src/lib/prisma.ts` contains `PrismaPg`
- [x] `src/actions/submit-job.ts` contains `export async function submitJob` and `submitJobSchema`
- [x] `vitest.config.mts` exists with `defineConfig`
- [x] `src/__tests__/youtube.test.ts` exists — 12 tests pass
- [x] `src/__tests__/submit-job.test.ts` exists — 8 tests pass
- [x] Commit `3b669e9` exists (task commit)
- [x] Commit `ba8395c` exists (docs/metadata commit)
- [x] `.planning/phases/01-anonymous-job-shell/01-01-SUMMARY.md` exists
