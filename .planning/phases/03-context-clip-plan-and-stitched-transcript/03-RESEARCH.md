# Phase 3: Context Clip Plan and Stitched Transcript - Research

**Researched:** 2026-06-23
**Domain:** TypeScript pure-function algorithm (worker) + Prisma migration + shadcn/base-ui tab UI (Next.js)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Context window algorithm — Segment-boundary snapping. Walk outward through the full transcript array from each `ClipMatch`'s outermost `segmentIndex` in both directions until cumulative duration >= 30 seconds. The expanded window always starts and ends at a natural transcript segment edge.
- **D-02:** Edge clip behavior — Truncate silently. When a match is near the video start or end, include whatever segments are available. No annotation or special marker.
- **D-03:** Entry schema — `{ sourceStartMs, sourceEndMs, text }`. Minimal and sufficient for STR-03.
- **D-04:** Storage — New `stitchedTranscript Json?` column on the `Job` table. Requires a Prisma migration.
- **D-05:** Gap markers — None. Non-adjacent context windows stored sequentially without sentinel entries.
- **D-06:** Tab container — Introduce tab layout in Phase 3: `Video | Transcript | Notes`. Transcript tab is fully populated. Video and Notes tabs are enabled and clickable but show "coming soon" messages.
- **D-07:** Transcript entry rendering — `[M:SS] text...` per line (timestamp-plus-text baseline).
- **D-08:** Empty clip plan — `stitchedTranscript` is empty array; Transcript tab shows `No mentions of "[topic]" were found in this video.`

### Claude's Discretion

- Context window size constant (30s default; exact value configurable by constant in worker)
- Exact copy for "coming soon" messages in Video and Notes tabs (specified in UI-SPEC)
- Transcript entry rendering format within the Transcript tab (timestamp-per-line baseline)
- Overlap/merge algorithm details (merge windows where expanded ranges overlap or are adjacent)
- Prisma field name for the new column (`stitchedTranscript` or similar)

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLP-02 | System can add surrounding context around each relevant segment, defaulting to approximately 30 seconds before and after where available. | Segment-boundary walk algorithm (D-01); CONTEXT_WINDOW_MS constant in worker; edge truncation (D-02). |
| CLP-03 | System can merge overlapping context windows before video processing. | Interval-merge algorithm after all expansions; produces canonical non-overlapping spans. |
| CLP-04 | System can preserve source timestamps for every planned segment. | `{ sourceStartMs, sourceEndMs, text }` entry schema (D-03); derived from `TranscriptSegment.offset` in milliseconds. |
| STR-01 | System can generate a transcript for the stitched video. | `buildStitchedTranscript()` in worker; maps merged spans to ordered `StitchedTranscriptEntry[]`. |
| STR-02 | User can view the stitched transcript alongside the stitched video. | Transcript tab in shadcn `Tabs` component on result page. |
| STR-03 | Stitched transcript entries can reference their original source timestamps. | `sourceStartMs` / `sourceEndMs` on each entry; rendered as `[M:SS]` timestamp prefix. |

</phase_requirements>

---

## Summary

Phase 3 is a pure logic + data + UI phase. There are no new external dependencies beyond a shadcn tabs component. The worker gains two new pure-function modules (`contextExpander.ts` and `stitchedTranscript.ts`). The database gains one new JSON column (`stitchedTranscript`) via a Prisma migration. The result page gains a tab layout with a transcript list.

The most critical insight from reading the existing code is that the status page (`src/app/status/page.tsx`) currently excludes DONE jobs from its Prisma query (`status: { notIn: ['DONE', 'FAILED'] }`). Phase 3 must change this query to also find the most recent DONE job so the transcript can be displayed on page load. The `stitchedTranscript` also needs to be passed as an initial prop to `StatusView` and updated via the Supabase Realtime payload.

The project uses `@base-ui/react` (not `@radix-ui`) as the component primitive for all shadcn components. The `base-nova` style preset routes to `@base-ui/react/tabs` — which is already installed in `node_modules`. Running `npx shadcn add tabs` is sufficient; no additional `npm install` of Radix packages is needed.

**Primary recommendation:** Implement context expansion and stitched transcript as two separate pure-function modules in `worker/src/`, then update the Prisma schema, worker index, and frontend in one coordinated change set.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Context window expansion (CLP-02) | Worker (Node.js) | — | Pure function on `TranscriptSegment[]`; no I/O |
| Overlap merging (CLP-03) | Worker (Node.js) | — | Pure interval-merge on sorted expanded spans |
| Source timestamp preservation (CLP-04) | Worker (Node.js) | Database | Computed at worker time; stored as `sourceStartMs/sourceEndMs` in JSON column |
| Stitched transcript generation (STR-01) | Worker (Node.js) | — | Maps merged spans to `StitchedTranscriptEntry[]`; written to DB on DONE |
| Transcript display (STR-02, STR-03) | Frontend (React/Next.js) | — | Reads `stitchedTranscript` from Job row; renders in Transcript tab |
| Schema migration | Database (Prisma) | — | New `stitchedTranscript Json?` column on Job model |

---

## Standard Stack

### Core (all already installed — no new npm installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@base-ui/react` (tabs) | `^1.5.0` (installed) | Tabs primitive for shadcn `Tabs` component | Already installed; `base-nova` preset requires it |
| `prisma` | `^7.8.0` (installed) | Schema migration for `stitchedTranscript Json?` | Established pattern from Phase 2 (transcript, clipPlan columns) |
| TypeScript | `^5` (installed) | Worker pure functions, type definitions | Project language |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn CLI | `^4.11.0` (installed) | `npx shadcn add tabs` to generate `tabs.tsx` | One-time scaffold; generates `src/components/ui/tabs.tsx` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `npx shadcn add tabs` | Hand-roll a tab component | Shadcn generates accessible Radix/Base-UI component that matches existing shadcn component patterns — never hand-roll |

**Installation:**

No new `npm install` calls are needed. The only install step is:

```bash
npx shadcn add tabs
```

This generates `src/components/ui/tabs.tsx` using `@base-ui/react/tabs` (already in `node_modules`). Verify with:

```bash
ls src/components/ui/tabs.tsx
```

**Version verification:**

```
@base-ui/react: 1.5.0 (from package.json — already installed)
@radix-ui/react-tabs: NOT USED — this project's base-nova preset routes through @base-ui/react
prisma: 7.8.0 (from package.json — already installed)
```

---

## Package Legitimacy Audit

The only new component artifact is the shadcn `tabs` component generated by `npx shadcn add tabs`. No new npm packages are being added.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@base-ui/react` (tabs sub-module) | npm | already installed | — | github.com/mui/base-ui | OK | Approved — already in package.json |

`@radix-ui/react-tabs` is NOT used in this project. The seam flagged `@radix-ui/react-tabs` as `SUS: too-new` (recent republish of v1.1.15, originally created 2020-12-15, 52M weekly downloads). This package is not being installed — it is noted here only for audit completeness.

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** `@radix-ui/react-tabs` — NOT installed (project uses `@base-ui/react` instead)

---

## Architecture Patterns

### System Architecture Diagram

```
Worker processPendingJob()
  │
  ├── fetchTranscript() → TranscriptSegment[]
  │
  ├── buildClipPlan() → ClipMatch[]       [Phase 2 — existing]
  │
  ├── expandContextWindows()               [Phase 3 — Plan 03-01]
  │     └── walk outward from ClipMatch.segmentIndices boundaries
  │         until cumulative duration >= CONTEXT_WINDOW_MS
  │         → ExpandedWindow[] (startIdx, endIdx, startMs, endMs)
  │
  ├── mergeOverlappingWindows()            [Phase 3 — Plan 03-01]
  │     └── sort by startMs, merge where endMs >= next.startMs
  │         → MergedWindow[]
  │
  ├── buildStitchedTranscript()            [Phase 3 — Plan 03-01]
  │     └── for each MergedWindow, collect segments[startIdx..endIdx]
  │         → StitchedTranscriptEntry[] { sourceStartMs, sourceEndMs, text }
  │
  └── prisma.job.update({ stitchedTranscript, clipPlan, transcript, status: DONE })

DB: Job row updated with stitchedTranscript JSONB
  │
  └── Supabase Realtime → postgres_changes UPDATE event
        │
        └── StatusView (client component)
              ├── setStitchedTranscript(payload.new.stitchedTranscript)
              └── Tabs > Transcript tab > renders [M:SS] text entries
```

### Recommended Project Structure

```
worker/src/
├── types.ts                   # Add StitchedTranscriptEntry interface
├── contextExpander.ts         # NEW: expandContextWindows(), mergeOverlappingWindows()
├── stitchedTranscript.ts      # NEW: buildStitchedTranscript()
├── matcher.ts                 # Existing — unchanged
├── transcript.ts              # Existing — unchanged
└── index.ts                   # Updated: call expander + stitched transcript before DONE update

prisma/
└── schema.prisma              # Add stitchedTranscript Json?

src/
├── types/job.ts               # Add StitchedTranscriptEntry, stitchedTranscript to Job
├── components/
│   ├── ui/tabs.tsx            # NEW: generated by npx shadcn add tabs
│   └── status-view.tsx        # Updated: Done state becomes tab container
└── app/status/page.tsx        # Updated: query includes DONE jobs; pass stitchedTranscript prop

worker/src/__tests__/
├── contextExpander.test.ts    # NEW: unit tests for expansion + merge
└── stitchedTranscript.test.ts # NEW: unit tests for transcript generation

src/__tests__/
└── status-view.test.tsx       # Updated: add DONE-with-transcript, DONE-empty tests
```

### Pattern 1: Segment-Boundary Context Expansion

**What:** Walk outward from a `ClipMatch`'s outermost segment indices, accumulating duration, until >= 30s collected in each direction.

**When to use:** After `buildClipPlan()`, before overlap merging.

**Example:**
```typescript
// Source: derived from CONTEXT.md D-01 + worker/src/types.ts
const CONTEXT_WINDOW_MS = 30_000 // 30 seconds — configurable

export interface ExpandedWindow {
  startIdx: number  // index into TranscriptSegment[]
  endIdx: number    // index into TranscriptSegment[]
  startMs: number   // Math.round(segments[startIdx].offset * 1000)
  endMs: number     // Math.round((segments[endIdx].offset + segments[endIdx].duration) * 1000)
}

export function expandContextWindows(
  segments: TranscriptSegment[],
  matches: ClipMatch[],
  contextMs = CONTEXT_WINDOW_MS
): ExpandedWindow[] {
  return matches.map(match => {
    const innerStart = Math.min(...match.segmentIndices)
    const innerEnd   = Math.max(...match.segmentIndices)

    // Walk left until >= contextMs accumulated or start of array
    let leftIdx = innerStart
    let leftMs = 0
    while (leftIdx > 0 && leftMs < contextMs) {
      leftIdx--
      leftMs += Math.round(segments[leftIdx].duration * 1000)
    }

    // Walk right until >= contextMs accumulated or end of array
    let rightIdx = innerEnd
    let rightMs = 0
    while (rightIdx < segments.length - 1 && rightMs < contextMs) {
      rightIdx++
      rightMs += Math.round(segments[rightIdx].duration * 1000)
    }

    return {
      startIdx: leftIdx,
      endIdx: rightIdx,
      startMs: Math.round(segments[leftIdx].offset * 1000),
      endMs: Math.round((segments[rightIdx].offset + segments[rightIdx].duration) * 1000),
    }
  })
}
```

### Pattern 2: Interval Overlap Merge

**What:** Sort windows by `startMs`, then merge any windows whose ranges overlap or are adjacent (endMs >= next.startMs after sorting).

**When to use:** After all windows are expanded, before building the stitched transcript.

**Example:**
```typescript
// Source: standard interval merge algorithm, adapted to ExpandedWindow
export function mergeOverlappingWindows(windows: ExpandedWindow[]): ExpandedWindow[] {
  if (windows.length === 0) return []

  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs)
  const merged: ExpandedWindow[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const curr = sorted[i]

    if (curr.startMs <= last.endMs) {
      // Overlapping or adjacent — extend the last window
      merged[merged.length - 1] = {
        startIdx: last.startIdx,
        endIdx: Math.max(last.endIdx, curr.endIdx),
        startMs: last.startMs,
        endMs: Math.max(last.endMs, curr.endMs),
      }
    } else {
      merged.push(curr)
    }
  }

  return merged
}
```

### Pattern 3: Stitched Transcript Generation

**What:** For each merged window, collect all `TranscriptSegment` entries from `startIdx` to `endIdx` (inclusive) and map each to a `StitchedTranscriptEntry`.

**Example:**
```typescript
// Source: derived from CONTEXT.md D-03, D-05
export interface StitchedTranscriptEntry {
  sourceStartMs: number
  sourceEndMs: number
  text: string
}

export function buildStitchedTranscript(
  segments: TranscriptSegment[],
  mergedWindows: ExpandedWindow[]
): StitchedTranscriptEntry[] {
  const entries: StitchedTranscriptEntry[] = []
  for (const window of mergedWindows) {
    for (let i = window.startIdx; i <= window.endIdx; i++) {
      const seg = segments[i]
      entries.push({
        sourceStartMs: Math.round(seg.offset * 1000),
        sourceEndMs: Math.round((seg.offset + seg.duration) * 1000),
        text: seg.text,
      })
    }
  }
  return entries
}
```

### Pattern 4: Worker Integration Point

**What:** Insert context expansion + stitched transcript generation in `processPendingJob()` between `buildClipPlan()` and `prisma.job.update()`.

**Example:**
```typescript
// Source: worker/src/index.ts (lines 60–71 — existing DONE update block)
const clipPlan = buildClipPlan(segments, job.topic)

// Phase 3: expand context windows, merge overlaps, build stitched transcript
const expandedWindows = expandContextWindows(segments, clipPlan)
const mergedWindows = mergeOverlappingWindows(expandedWindows)
const stitchedTranscript = buildStitchedTranscript(segments, mergedWindows)

await prisma.job.update({
  where: { id: job.id },
  data: {
    transcript: segments as unknown as Prisma.InputJsonValue,
    clipPlan: clipPlan as unknown as Prisma.InputJsonValue,
    stitchedTranscript: stitchedTranscript as unknown as Prisma.InputJsonValue,
    status: 'DONE',
  },
})
```

### Pattern 5: Status Page Query Fix (CRITICAL)

**What:** The status page currently excludes DONE jobs. Phase 3 must change the query to find the most recent job regardless of status (but still only the user's own jobs).

**Why this is critical:** Without this fix, users who arrive at `/status` after a job completes will see "No active job" instead of their results.

**Example:**
```typescript
// Source: src/app/status/page.tsx — BEFORE (Phase 2)
// status: { notIn: ['DONE', 'FAILED'] }   ← excludes DONE, no transcript shown

// AFTER (Phase 3):
const job = await prisma.job.findFirst({
  where: { userId: user.id },           // remove status filter
  orderBy: { createdAt: 'desc' },
})
// Still redirect to / if no job at all
```

### Pattern 6: StatusView — Passing stitchedTranscript

**What:** `status-view.tsx` needs `stitchedTranscript` and `topic` as initial props. The Supabase Realtime handler must also update `stitchedTranscript` from `payload.new`.

**Example:**
```typescript
// StatusViewProps extension:
interface StatusViewProps {
  userId: string
  initialStatus: string
  initialJobId: string
  initialErrorMessage: string | null
  initialStitchedTranscript: StitchedTranscriptEntry[] | null  // NEW
  topic: string                                                 // NEW
}

// Realtime handler addition:
setStitchedTranscript(payload.new.stitchedTranscript ?? null)
```

### Pattern 7: Tabs UI (shadcn base-nova)

**What:** `npx shadcn add tabs` generates `src/components/ui/tabs.tsx` using `@base-ui/react/tabs`.

**API (from UI-SPEC and shadcn official docs):**
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

<Tabs defaultValue="transcript">
  <TabsList>
    <TabsTrigger value="video">Video</TabsTrigger>
    <TabsTrigger value="transcript">Transcript</TabsTrigger>
    <TabsTrigger value="notes">Notes</TabsTrigger>
  </TabsList>
  <TabsContent value="video">
    <p className="text-base text-muted-foreground">
      Video clips will be available here once processing is complete.
    </p>
  </TabsContent>
  <TabsContent value="transcript">
    {/* transcript list or empty state */}
  </TabsContent>
  <TabsContent value="notes">
    <p className="text-base text-muted-foreground">
      Study notes will appear here in a future update.
    </p>
  </TabsContent>
</Tabs>
```

### Pattern 8: Timestamp Formatting

**What:** Format `sourceStartMs` as `[M:SS]` per UI-SPEC.

**Example:**
```typescript
// Source: 03-UI-SPEC.md — Transcript Entry Rendering
function formatTimestamp(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  return `[${minutes}:${seconds}]`
}
// Examples: [1:04], [12:30], [0:05]
```

### Anti-Patterns to Avoid

- **Splitting context expansion into separate left/right arrays:** Keep it as a single walk per match — merge happens after expansion, not during.
- **Using index-0 as a sentinel for "no match":** Indices are zero-valid; use an empty array (`[]`) to signal no matches.
- **Storing `segmentIndices` in `stitchedTranscript` entries:** Entries only need `{ sourceStartMs, sourceEndMs, text }` per D-03.
- **Setting tab triggers to `disabled`:** D-06 requires all three tabs to be enabled and clickable.
- **Changing card width for all states:** Only the Done state should expand to `max-w-2xl`; PENDING/PROCESSING/FAILED stay `max-w-md`.
- **Querying only non-DONE jobs in status page:** This is the existing bug — Phase 3 must fix it so DONE jobs are displayed.
- **Passing `stitchedTranscript` as a URL param:** The job ID is never in the URL (Phase 1 D-07); all data comes from the server query or Realtime.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible tab component | Custom div + aria roles | `npx shadcn add tabs` | Radix/Base-UI handles keyboard nav, tablist/tab/tabpanel ARIA roles, active state |
| Interval merge algorithm | Ad-hoc overlap checks | Standard sort-then-merge algorithm (documented above) | The standard O(n log n) merge is well-understood, bug-free for all edge cases including adjacent windows |
| Prisma JSON type casting | Direct type assignment | `value as unknown as Prisma.InputJsonValue` | Established pattern from Phase 2; Prisma 7 requires this cast for complex objects |

**Key insight:** The algorithm work in this phase is pure TypeScript with no tricky edge cases beyond the array boundary conditions (already handled by `while leftIdx > 0` guards). The UI complexity comes from correctly threading `stitchedTranscript` through the component tree — not from the component itself.

---

## Common Pitfalls

### Pitfall 1: Status Page Excludes DONE Jobs
**What goes wrong:** The status page currently has `status: { notIn: ['DONE', 'FAILED'] }`. Users arriving at `/status` after a job finishes see "No active job" and a redirect to `/`.
**Why it happens:** The Phase 2 page was designed to find only active jobs. Phase 3 is the first phase that needs the DONE state to show data.
**How to avoid:** Change the Prisma query to `where: { userId: user.id }` (remove the status filter). Still redirect if `job === null`.
**Warning signs:** Clicking "Submit" completes, status page redirects back to home instead of showing "Done!".

### Pitfall 2: stitchedTranscript Not in Realtime Payload
**What goes wrong:** Supabase Realtime `postgres_changes` payloads for large rows may not include full JSONB column values if the row exceeds the Realtime payload limit.
**Why it happens:** Supabase Realtime has a default max payload size (~1MB). For long videos with many transcript segments, `stitchedTranscript` may be large.
**How to avoid:** In `StatusView`, treat `payload.new.stitchedTranscript` as potentially `undefined`. If missing, re-fetch the job from the API on DONE transition. For the MVP (exact-match, typical short mention lists), this limit is unlikely to be hit — but the code should handle `undefined` gracefully.
**Warning signs:** Transcript tab is empty after status shows "Done!"; no JS errors in console.

### Pitfall 3: Float Precision in Duration Accumulation
**What goes wrong:** Walking right/left accumulates `Math.round(segment.duration * 1000)`. If `duration` has floating-point representation issues (e.g., `2.9999999`), the cumulative sum may be off by 1ms.
**Why it happens:** `TranscriptSegment.duration` is a float in seconds.
**How to avoid:** Use `Math.round()` on each segment's duration-in-ms before accumulating — already shown in the expansion algorithm. The 1ms error has no practical impact (30s context window; 1ms variance is irrelevant).
**Warning signs:** Context window is 1ms short of 30s — acceptable edge case.

### Pitfall 4: Card Width Change Breaks PENDING/FAILED States
**What goes wrong:** `status-view.tsx` currently has `<Card className="w-full max-w-md">` unconditionally. Phase 3 must expand to `max-w-2xl` only in the DONE state.
**Why it happens:** If the className is changed unconditionally, PENDING/FAILED states become too wide.
**How to avoid:** Make card width conditional: `className={cn('w-full', isDone ? 'max-w-2xl' : 'max-w-md')}`.
**Warning signs:** PENDING state card is unexpectedly wide.

### Pitfall 5: base-nova Tabs Use @base-ui/react, Not @radix-ui
**What goes wrong:** Developer attempts to install `@radix-ui/react-tabs` and import from it directly, bypassing the shadcn wrapper.
**Why it happens:** Training data shows Radix as the shadcn default; the `base-nova` preset is newer.
**How to avoid:** Use `npx shadcn add tabs` and import `{ Tabs, TabsList, TabsTrigger, TabsContent }` from `@/components/ui/tabs`. Never import from `@radix-ui/react-tabs` or `@base-ui/react/tabs` directly in component files.
**Warning signs:** `npm install @radix-ui/react-tabs` runs; the generated `tabs.tsx` imports from the wrong primitive.

### Pitfall 6: Prisma Generate After Schema Change
**What goes wrong:** After adding `stitchedTranscript Json?` to `schema.prisma`, running the worker without regenerating the Prisma client fails because the generated client doesn't include the new field.
**Why it happens:** Prisma generates a typed client from the schema. Schema changes require `npx prisma generate` + `npm run build` in the worker.
**How to avoid:** After `npx prisma migrate dev`, run `npx prisma generate`. In the worker, the build script is `npx prisma generate --schema=../prisma/schema.prisma`.
**Warning signs:** TypeScript error `Property 'stitchedTranscript' does not exist on type...` in worker.

---

## Code Examples

### Prisma Schema Addition
```prisma
// Source: prisma/schema.prisma — existing pattern from Phase 2
model Job {
  id                  String    @id @default(uuid())
  userId              String
  youtubeUrl          String
  topic               String
  status              JobStatus @default(PENDING)
  errorMessage        String?
  transcript          Json?
  clipPlan            Json?
  stitchedTranscript  Json?     // NEW in Phase 3
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([userId])
}
```

### Prisma Migration SQL (expected output)
```sql
-- Phase 3 migration (name: add_stitched_transcript)
ALTER TABLE "Job" ADD COLUMN "stitchedTranscript" JSONB;
```

### src/types/job.ts Addition
```typescript
// NEW interface for stitched transcript entries
export interface StitchedTranscriptEntry {
  sourceStartMs: number
  sourceEndMs: number
  text: string
}

// Extended Job interface
export interface Job {
  // ... existing fields ...
  stitchedTranscript: StitchedTranscriptEntry[] | null  // NEW
}
```

### Transcript Tab Rendering
```tsx
// Source: 03-UI-SPEC.md — transcript entry rendering
{isDone && (
  <div className="flex flex-col gap-2">
    {(stitchedTranscript?.length ?? 0) === 0 ? (
      <p className="text-base text-muted-foreground">
        No mentions of &quot;{topic}&quot; were found in this video.
      </p>
    ) : (
      stitchedTranscript!.map((entry, i) => (
        <div key={i} className="flex gap-2 items-baseline">
          <span className="text-sm font-semibold text-foreground shrink-0">
            {formatTimestamp(entry.sourceStartMs)}
          </span>
          <span className="text-base text-foreground">{entry.text}</span>
        </div>
      ))
    )}
  </div>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@radix-ui/react-tabs` as default shadcn primitive | `@base-ui/react/tabs` via `base-nova` preset | shadcn introduced `base-nova` style | Do not install `@radix-ui/react-tabs`; shadcn add tabs handles it |
| Prisma 6 `url` in datasource block | Prisma 7 `prisma.config.ts` with `datasource.url` | Prisma 7 | The project already uses `prisma.config.ts`; no change needed |

**Deprecated/outdated:**
- `url` in `datasource` block: replaced by `prisma.config.ts` in Prisma 7 — already correct in this project.
- `@radix-ui/react-tabs` direct import: not applicable for `base-nova` shadcn projects.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `npx shadcn add tabs` for `base-nova` generates a component using `@base-ui/react/tabs` (not `@radix-ui/react-tabs`). | Standard Stack, Pitfall 5 | If wrong, the generated component would import from radix and require `npm install @radix-ui/react-tabs`. Low risk — confirmed by inspecting existing `progress.tsx` and `button.tsx` which use `@base-ui/react`. |
| A2 | Supabase Realtime `postgres_changes` payload includes the `stitchedTranscript` JSONB column for typical job sizes. | Pitfall 2 | If wrong, the Transcript tab appears empty on live Realtime update; page refresh would show content. Workaround: re-fetch on DONE transition if `payload.new.stitchedTranscript` is undefined. |

---

## Open Questions

1. **Realtime payload size for large transcripts**
   - What we know: Supabase Realtime has a ~1MB default payload limit. `stitchedTranscript` for a typical short mention list is well under this.
   - What's unclear: Whether long videos (30+ minutes) with many matches could produce `stitchedTranscript` arrays approaching the limit.
   - Recommendation: For MVP (Phase 3), accept the risk. Add a Realtime fallback re-fetch in Phase 4 if needed.

2. **`key` prop for transcript entries**
   - What we know: Using array index as `key` is acceptable for a static read-only list.
   - What's unclear: Whether future phases add reordering or filtering that would break index-based keys.
   - Recommendation: Use index as key in Phase 3. Phase 4/5 can revisit if needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Worker pure functions | ✓ | v22.19.0 | — |
| `prisma` CLI | `npx prisma migrate dev` | ✓ | 7.8.0 | — |
| `npx shadcn add tabs` | Generate tabs component | ✓ | shadcn 4.11.0 | — |
| `@base-ui/react/tabs` | Tabs primitive (via shadcn) | ✓ | 1.5.0 (already installed) | — |
| Supabase Realtime | Live status updates | ✓ | (existing setup) | — |
| DIRECT_URL (env) | `npx prisma migrate dev` | User-managed | — | Session-mode pooler URL |

**Missing dependencies with no fallback:** None.

**Notes:** `npx prisma migrate dev` requires `DIRECT_URL` in `.env.local` pointing to the session-mode pooler URL (not the transaction-mode pooler). This is an existing constraint from Phases 1–2, not new.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.8 |
| Config file (worker) | `worker/vitest.config.ts` — environment: node |
| Config file (frontend) | `vitest.config.ts` — environment: jsdom |
| Quick run command (worker) | `cd worker && npm run test:run` |
| Quick run command (frontend) | `npm run test:run` |
| Full suite command | `npm run test:run && cd worker && npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLP-02 | `expandContextWindows()` adds ~30s before/after each match | unit | `cd worker && npm run test:run -- contextExpander` | ❌ Wave 0 |
| CLP-02 | Edge truncation: match near video start/end | unit | `cd worker && npm run test:run -- contextExpander` | ❌ Wave 0 |
| CLP-03 | `mergeOverlappingWindows()` merges overlapping windows | unit | `cd worker && npm run test:run -- contextExpander` | ❌ Wave 0 |
| CLP-03 | Adjacent (touching) windows are merged | unit | `cd worker && npm run test:run -- contextExpander` | ❌ Wave 0 |
| CLP-04 | Each entry has `sourceStartMs` and `sourceEndMs` | unit | `cd worker && npm run test:run -- stitchedTranscript` | ❌ Wave 0 |
| STR-01 | `buildStitchedTranscript()` returns ordered entries | unit | `cd worker && npm run test:run -- stitchedTranscript` | ❌ Wave 0 |
| STR-01 | Empty `clipPlan` → empty `stitchedTranscript` | unit | `cd worker && npm run test:run -- stitchedTranscript` | ❌ Wave 0 |
| STR-02 | Transcript tab renders entries in DONE state | unit | `npm run test:run -- status-view` | ❌ needs update |
| STR-02 | Empty state message shown when stitchedTranscript is empty | unit | `npm run test:run -- status-view` | ❌ needs update |
| STR-03 | Each entry renders `[M:SS]` timestamp from `sourceStartMs` | unit | `npm run test:run -- status-view` | ❌ needs update |

### Sampling Rate

- **Per task commit:** `cd worker && npm run test:run` (worker changes) or `npm run test:run` (frontend changes)
- **Per wave merge:** `npm run test:run && cd worker && npm run test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `worker/src/__tests__/contextExpander.test.ts` — covers CLP-02 and CLP-03
- [ ] `worker/src/__tests__/stitchedTranscript.test.ts` — covers CLP-04, STR-01
- [ ] `src/__tests__/status-view.test.tsx` — existing file needs new test cases for DONE+transcript, DONE+empty, tab rendering (STR-02, STR-03)

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes in this phase |
| V3 Session Management | no | Session unchanged |
| V4 Access Control | yes | `stitchedTranscript` only returned for user's own job — status page query scoped by `userId` (existing pattern) |
| V5 Input Validation | no | No new user inputs; `topic` already validated in Phase 1 |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: user reads another user's `stitchedTranscript` | Elevation of Privilege | Status page query already scoped by `userId`; RLS on Job table enforced in Supabase |
| XSS via transcript text | Tampering | Transcript text rendered as JSX text nodes (never `dangerouslySetInnerHTML`) — existing pattern from `status-view.tsx` |
| Topic value in empty-state message | Tampering | Topic rendered as JSX text node: `{topic}` — no HTML injection possible in React |

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive | Implication for Phase 3 |
|-----------|------------------------|
| "This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before writing code" | Heed deprecation notices; the project uses Next.js 16.2.9 with App Router. No changes to routing in Phase 3 — `status/page.tsx` already uses App Router patterns. `export const dynamic = 'force-dynamic'` already present on the status page. |
| `base-nova` shadcn preset | Use `npx shadcn add tabs` (not direct `@radix-ui/react-tabs` install). All UI components use `@base-ui/react` primitives. |
| Prisma 7 with `prisma.config.ts` | `prisma.config.ts` in project root reads `DIRECT_URL` from `.env.local`. Do not add `url` to `datasource` block in `schema.prisma`. |
| Generated client at `prisma/generated/prisma` | Worker imports from `../../prisma/generated/prisma/client`. After schema change, run `npx prisma generate --schema=../prisma/schema.prisma` in the worker directory. |
| `security_enforcement: true`, `security_block_on: high` | RLS and userId scoping are required on the `stitchedTranscript` field. All rendering must use JSX text nodes. |
| `nyquist_validation: true` | Tests required for all new pure functions; existing `status-view.test.tsx` must be updated. |

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `worker/src/types.ts` — `TranscriptSegment` and `ClipMatch` interfaces; `offset` is seconds (not ms)
- `worker/src/matcher.ts` — `buildClipPlan()` output shape; `segmentIndices` confirmed present
- `worker/src/index.ts` — exact insertion point for Phase 3 logic (after `buildClipPlan()`, before `prisma.job.update()`)
- `prisma/schema.prisma` — current Job model; `transcript Json?` and `clipPlan Json?` as migration model
- `src/components/status-view.tsx` — Done-state placeholder at line 174–177; Realtime handler at line 79–82
- `src/app/status/page.tsx` — `status: { notIn: ['DONE', 'FAILED'] }` bug confirmed at line ~35
- `src/types/job.ts` — `Job` interface; needs `stitchedTranscript` and mirror types
- `src/components/ui/progress.tsx` — confirms `@base-ui/react` is the primitive library for this project
- `src/components/ui/button.tsx` — confirms `@base-ui/react` for shadcn components
- `components.json` — `style: "base-nova"` confirmed
- `node_modules/@base-ui/react/tabs/` — `@base-ui/react/tabs` already installed; exports `Root, List, Tab, Panel, Indicator`
- `.planning/phases/03-context-clip-plan-and-stitched-transcript/03-CONTEXT.md` — all locked decisions
- `.planning/phases/03-context-clip-plan-and-stitched-transcript/03-UI-SPEC.md` — layout, copy, accessibility specs
- `prisma/migrations/20260618000004_add_transcript_clip_plan/migration.sql` — established migration pattern

### Secondary (MEDIUM confidence)

- shadcn official docs (ui.shadcn.com/docs/components/tabs) — confirms `Tabs, TabsList, TabsTrigger, TabsContent` as export names; both Radix and Base UI variants exist

### Tertiary (LOW confidence / ASSUMED)

- A2: Supabase Realtime payload behavior for `stitchedTranscript` JSONB columns [ASSUMED] — not verified against live Supabase config

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in `node_modules` and `package.json`
- Architecture: HIGH — all insertion points confirmed by reading actual source files
- Pitfalls: HIGH — Pitfall 1 (status page query bug) and Pitfall 5 (base-ui vs radix) confirmed by direct code inspection
- UI spec: HIGH — 03-UI-SPEC.md is the authoritative source, read directly

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (30 days — stable stack, no fast-moving dependencies)
