---
phase: 01-anonymous-job-shell
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - prisma/schema.prisma
  - src/__tests__/setup.ts
  - src/__tests__/status-view.test.tsx
  - src/__tests__/submission-form.test.tsx
  - src/__tests__/submit-job.test.ts
  - src/__tests__/youtube.test.ts
  - src/actions/submit-job.ts
  - src/app/api/health/route.ts
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/app/status/page.tsx
  - src/components/loading-overlay.tsx
  - src/components/status-view.tsx
  - src/components/submission-form.tsx
  - src/lib/prisma.ts
  - src/lib/supabase/client.ts
  - src/lib/supabase/server.ts
  - src/lib/utils.ts
  - src/lib/youtube.ts
  - src/types/job.ts
  - proxy.ts
  - prisma.config.ts
  - next.config.ts
findings:
  critical: 5
  warning: 5
  info: 3
  total: 13
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

The anonymous job shell covers session management, form submission via a Server Action, job creation in Postgres via Prisma, and a live-status view driven by Supabase Realtime. The architecture choices (always `getUser()`, no jobId in URL, Zod safeParse before DB) are sound. However, five correctness/security defects were found that must be fixed before this ships: an unhandled Prisma exception that crashes the Server Action on DB error, a Realtime filter that references the wrong PostgreSQL column name (camelCase vs snake_case), a Realtime subscription that is not scoped to a specific job so any job update for the user triggers a state change, an open IDOR path where the status page reveals any job for the user rather than the just-submitted one, and the `jobId` returned by the Server Action being silently discarded before it reaches `StatusView`, making the job-scoping fix impossible without a carrier mechanism. There are also five warnings of varying gravity.

---

## Critical Issues

### CR-01: Prisma `job.create` throws unhandled — Server Action crashes on DB error

**File:** `src/actions/submit-job.ts:65-72`

**Issue:** `prisma.job.create(...)` is called with no try/catch. Any database error (constraint violation, connection timeout, Supabase pool exhaustion) throws an unhandled exception from inside a `'use server'` function. In Next.js App Router, an unhandled throw from a Server Action results in a generic 500 error page visible to the user, losing all form state, and leaking an error boundary rather than returning a structured `{ error }` that the form can display gracefully. This is a correctness and UX-safety defect on every DB failure path.

**Fix:**
```typescript
try {
  const job = await prisma.job.create({
    data: { userId: user.id, youtubeUrl, topic, status: 'PENDING' },
  })
  return { jobId: job.id }
} catch (err) {
  console.error('[submitJob] prisma.job.create failed:', err)
  return { error: 'Could not save your job — please try again.' }
}
```

---

### CR-02: Realtime filter uses camelCase `userId` — column name is snake_case in PostgreSQL

**File:** `src/components/status-view.tsx:80`

**Issue:** The Supabase Realtime filter string is:
```
filter: `userId=eq.${userId}`
```
Prisma generates PostgreSQL column names in snake_case by default unless `@map` is used. The schema has no `@map` annotation on `userId`, which means Prisma 7 will create the column as `"userId"` (quoted camelCase) **only if** using the `prismaClientExtension` output option — but this is not guaranteed across Prisma versions and is explicitly called out as "Pitfall 3" in the project's own RESEARCH.md. More critically, Supabase Realtime filter expressions use the **unquoted** PostgreSQL identifier; if the actual column is `user_id` (snake_case), the filter silently fails to match and no Realtime updates are ever delivered to the client. The app then appears to work (the initial server-rendered status is correct) but never live-updates.

The schema comment on line 79 acknowledges uncertainty ("verify with `\d "Job"` after migration") but ships with the ambiguous string anyway. If the column is `user_id`, every user would see a subscription that never fires.

**Fix:** Add an explicit `@map` annotation in the Prisma schema to lock in the exact column name, then use it consistently in the filter:

```prisma
// schema.prisma
model Job {
  id           String    @id @default(uuid())
  userId       String    @map("user_id")
  ...
  @@index([userId])
  @@map("jobs")   // also map the table name to lowercase
}
```

Then update the filter:
```typescript
filter: `user_id=eq.${userId}`,
```
Until the actual column name is confirmed and locked, this is a silent data-delivery failure in production.

---

### CR-03: Realtime subscription is not scoped to a specific job — any job UPDATE fires state change

**File:** `src/components/status-view.tsx:69-88`

**Issue:** The Realtime channel filters only on `userId`. If a user has multiple jobs (e.g. submits a second job while the first is still visible on the status page, or if a previous failed job is later retried by a background worker), **any** UPDATE to any of that user's job rows will trigger `setStatus` and `setErrorMessage` in the current view. The `initialJobId` prop is accepted by `StatusView` but immediately aliased to `_initialJobId` (underscore prefix = unused) on line 45. This means the component has no mechanism to ignore updates for other jobs.

This is a correctness defect: the status view can silently switch to displaying the wrong job's status without the user being aware.

**Fix:** Add a job ID filter to the Realtime subscription:
```typescript
// Use initialJobId (remove the underscore alias)
initialJobId,   // in destructuring

// In the Realtime .on() config:
filter: `id=eq.${initialJobId}`,   // scope to this exact job row
```
The `userId` channel name can remain for uniqueness, but the row-level filter must target the specific job.

---

### CR-04: Status page does not correlate to the just-submitted job — IDOR and stale-state risk

**File:** `src/app/status/page.tsx:31-41`

**Issue:** When the user is redirected to `/status` after form submission, the status page queries:
```typescript
prisma.job.findFirst({
  where: { userId: user.id, status: { notIn: ['DONE', 'FAILED'] } },
  orderBy: { createdAt: 'desc' },
})
```
This query returns the most recent non-terminal job for the user — not necessarily the job just created. There is a race window where a concurrent submission (e.g. double-tap, duplicate tab) creates a second job between the Server Action returning and the status page rendering. The user would then see the second job's status page while the first job runs unmonitored. Additionally, the `jobId` returned by `submitJob` is captured in React in-memory state in `SubmissionForm` (line 142) but is discarded the moment `router.push('/status')` is called — `StatusView` then has no way to know which specific job it should be watching.

Combined with CR-03, this means `StatusView` monitors all user jobs and the page renders any recent non-terminal job; neither is tied to the specific submitted job.

**Fix:** Pass the jobId through a mechanism that survives the navigation. The documented design decision (D-07) avoids query params; acceptable alternatives include a short-lived server-side session cookie set during the Server Action (before returning jobId), or a Next.js route segment store. At minimum, `StatusView` must filter its Realtime subscription by the specific jobId (CR-03 fix), and the status page must resolve which job to display using the same jobId.

---

### CR-05: `submitJob` `getUser()` auth error is silently swallowed — unauthenticated DB write possible

**File:** `src/actions/submit-job.ts:54-61`

**Issue:** The Supabase `getUser()` call can itself fail with a network error:
```typescript
const { data: { user } } = await supabase.auth.getUser()
```
`getUser()` returns `{ data: { user }, error }`. The code destructures only `data.user` and ignores the `error` field entirely. If the Supabase Auth service is unreachable, `getUser()` resolves successfully with `user = null` and `error` set — the `if (!user)` guard correctly catches this case and returns `{ error: '...' }`, so the null check is adequate. However, if `getUser()` throws (a network exception rather than a structured error), there is no try/catch, and the Server Action crashes with an unhandled exception (see CR-01 for the same pattern). This is the same root cause as CR-01 and the fix is the same outer try/catch, but it is worth calling out that the `error` field from `getUser()` is never inspected, making the distinction between "no user" and "auth failure" invisible in logs.

**Fix:** Destructure and log the auth error for observability:
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError) {
  console.error('[submitJob] getUser error:', authError.message)
}
if (!user) {
  return { error: 'No session — please refresh and try again.' }
}
```

---

## Warnings

### WR-01: `initialJobId` prop accepted but structurally unused — dead interface surface

**File:** `src/components/status-view.tsx:27,45`

**Issue:** `initialJobId` is declared in `StatusViewProps` and accepted in the component signature, but is immediately shadowed with an underscore prefix (`_initialJobId`) on line 45, making it intentionally unused. This is not a placeholder for a future phase — CR-03 requires it to correctly scope the Realtime subscription. Keeping an underscore-prefixed prop in a public interface signals to readers that the prop is vestigial, which is misleading. TypeScript will not warn about this because the underscore convention suppresses unused-variable checks.

**Fix:** Either remove the prop until it is used, or use it (the CR-03 fix does this). Do not ship a public prop that is documented as "passed from the parent" but silently discarded.

---

### WR-02: `PrismaPg` adapter instantiated at module load time with bare `!` assertion on `DATABASE_URL`

**File:** `src/lib/prisma.ts:10-11`

**Issue:**
```typescript
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
```
The `!` non-null assertion suppresses TypeScript's undefined check. If `DATABASE_URL` is not set (e.g. in a test environment, a cold deploy before secrets are injected, or a misconfigured Vercel environment), `new PrismaPg({ connectionString: undefined })` is called at module load time. Depending on the pg driver version, this may throw immediately (crashing all imports of `prisma`) or defer the error until the first query (where the error message is misleading). There is no runtime guard.

**Fix:**
```typescript
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}
const adapter = new PrismaPg({ connectionString })
```

---

### WR-03: `proxy.ts` `setAll` does not forward cookie `options` to `request.cookies.set`

**File:** `proxy.ts:20-23`

**Issue:** In the `setAll` cookie handler:
```typescript
cookiesToSet.forEach(({ name, value }) =>
  request.cookies.set(name, value)       // options dropped here
)
response = NextResponse.next({ request })
cookiesToSet.forEach(({ name, value, options }) =>
  response.cookies.set(name, value, options)  // options forwarded here
)
```
Cookie `options` (including `Max-Age`, `SameSite`, `Secure`, `HttpOnly`) are omitted when writing back to `request.cookies`. The `request.cookies.set` call is used to propagate the refreshed cookies to downstream server components via the mutated `request` object passed to `NextResponse.next({ request })`. Because options are dropped in the request mutation, any downstream component that reads these cookies before the response is sent gets cookies without their security attributes applied. In practice, `request.cookies` are read-only in most middleware scenarios and the `response.cookies` are what matter for the client, but this is a deviation from the documented Supabase SSR pattern where both sets must receive identical options.

**Fix:** Pass `options` to both sets:
```typescript
cookiesToSet.forEach(({ name, value, options }) =>
  request.cookies.set(name, value, options)
)
```

---

### WR-04: `StatusView` progress bar remains visible in `DONE` state after Realtime update — no cleanup of progress interval

**File:** `src/components/status-view.tsx:97-124`

**Issue:** The progress animation `useEffect` at line 97 depends on `[status]`. When `status` transitions from `PENDING` to `DONE` (via a Realtime payload), the effect re-runs, clears the old interval, and sets `progress` to 100. However, if `status` transitions from `PROCESSING` directly to `DONE` while the interval callback fires in the same tick, there is a potential state update on an unmounted component if the user navigates away. More concretely: `progressIntervalRef.current` is nulled at line 101 before the new interval is potentially set, but the cleanup function at lines 118-122 checks `progressIntervalRef.current` again. If `status === 'DONE'`, no interval is set (correct), but the cleanup function still runs and the `null` check safely exits. This is correct but fragile — the dual clear pattern (lines 99-101 and 118-122) is redundant and the reason for the pre-clear on line 99 is not documented. A future edit could break the invariant.

Additionally, the message cycling `useEffect` at line 127 returns early if `!isActive`, but does not reset `messageIndex` to 0 when the job completes. If a user somehow returns to a PENDING state (e.g. via browser back, though this is currently impossible), the message cycle would resume from a non-zero index. Minor but inconsistent.

**Fix:** Consolidate the progress interval into a single effect with a clear cleanup:
```typescript
useEffect(() => {
  if (status !== JobStatus.PENDING && status !== JobStatus.PROCESSING) {
    if (status === JobStatus.DONE) setProgress(100)
    return
  }
  const id = setInterval(() => {
    setProgress((prev) => prev >= 90 ? prev : Math.min(prev + 5, 90))
  }, 2000)
  return () => clearInterval(id)
}, [status])
```

---

### WR-05: `submitJob` schema test validates `youtu.be` short URL but `YOUTUBE_REGEX` may not match all valid short IDs

**File:** `src/lib/youtube.ts:6-7` / `src/__tests__/submit-job.test.ts:59-65`

**Issue:** The `YOUTUBE_REGEX` pattern requires exactly 11 characters in `[a-zA-Z0-9_-]`:
```
([a-zA-Z0-9_-]{11})
```
YouTube video IDs are 11 characters, so this is correct for standard IDs. However, the `YOUTUBE_REGEX` does not anchor the end of the ID group — a URL like `https://youtu.be/dQw4w9WgXcQEXTRA` would still match (extracting `dQw4w9WgXcQ`). This means `isYouTubeUrl` returns `true` for URLs with garbage appended after the video ID, as long as the first 11 characters of the path segment are alphanumeric. This is a lax validation that could permit malformed URLs to pass Zod validation and reach the DB.

The test suite does not include a case like `https://youtu.be/dQw4w9WgXcQEXTRA` to verify rejection.

**Fix:** Anchor the video ID capture group with a word boundary or end-of-path check:
```typescript
export const YOUTUBE_REGEX =
  /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^a-zA-Z0-9_-]|$)/
```
Add a test case for the over-long ID scenario.

---

## Info

### IN-01: `.env.local.example` file is missing

**File:** (project root — file does not exist)

**Issue:** The plan (`01-01-PLAN.md` step for environment setup) calls for creating `.env.local.example` with placeholder keys. This file does not exist in the repository. New developers cloning the repo have no reference for which environment variables are required (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DIRECT_URL`). The application fails at runtime with cryptic errors if any of these are absent.

**Fix:** Create `.env.local.example` at the project root:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
DATABASE_URL=
DIRECT_URL=
```

---

### IN-02: `SubmitJobResult` type uses a deeply-nested conditional type that is unnecessarily complex

**File:** `src/actions/submit-job.ts:23-26`

**Issue:**
```typescript
type SubmitJobResult =
  | { errors: ReturnType<typeof submitJobSchema.safeParse>['error'] extends infer E ? E extends z.ZodError ? ReturnType<z.ZodError['flatten']> : never : never }
  | { error: string }
  | { jobId: string }
```
The `errors` branch extracts the flattened Zod error type through a two-level conditional type. This is equivalent to `z.ZodError['flatten'] extends (...) => infer R ? R : never` which resolves to `{ formErrors: string[]; fieldErrors: { [K in string]?: string[] } }`. Zod 4 exports this type directly as `z.ZodFormattedError` or can be expressed as `ReturnType<z.ZodError<z.infer<typeof submitJobSchema>>['flatten']>`. The current form is hard to read and will confuse maintainers.

**Fix:**
```typescript
type SubmitJobResult =
  | { errors: ReturnType<z.ZodError<z.infer<typeof submitJobSchema>>['flatten']> }
  | { error: string }
  | { jobId: string }
```

---

### IN-03: `LoadingOverlay` `aria-hidden="true"` hides the spinner from screen readers but the overlay blocks interaction without announcing it

**File:** `src/components/loading-overlay.tsx:24`

**Issue:** The overlay uses `aria-hidden="true"`, which is correct for decorative spinners. However, when the overlay is visible it also `disabled={isPending}` the inputs and button (in `FormContent`). Screen readers will not be notified that the form has become non-interactive because the overlay itself is hidden and there is no `aria-live` announcement of the pending state. The `aria-disabled` state on the inputs provides some signal, but there is no explicit region announcing "Submitting..." to assistive technology.

**Fix:** Add an `aria-live="polite"` visually-hidden region in `SubmissionForm` that announces when submission is pending:
```tsx
<span className="sr-only" aria-live="polite">
  {isPending ? 'Submitting your request...' : ''}
</span>
```
This is a low-severity accessibility gap, not a blocking issue, but worth tracking.

---

_Reviewed: 2026-06-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
