# Phase 3: Context Clip Plan and Stitched Transcript - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 9
**Analogs found:** 8 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `worker/src/contextExpander.ts` | utility | transform | `worker/src/matcher.ts` | role-match |
| `worker/src/stitchedTranscript.ts` | utility | transform | `worker/src/matcher.ts` | role-match |
| `worker/src/types.ts` | model | — | self (extend) | exact |
| `worker/src/index.ts` | service | request-response | self (modify) | exact |
| `prisma/schema.prisma` | config | — | self (extend) | exact |
| `src/types/job.ts` | model | — | self (extend) | exact |
| `src/components/ui/tabs.tsx` | component | — | `src/components/ui/progress.tsx` | role-match |
| `src/components/status-view.tsx` | component | event-driven | self (modify) | exact |
| `src/app/status/page.tsx` | controller | request-response | self (modify) | exact |
| `worker/src/__tests__/contextExpander.test.ts` | test | — | `worker/src/__tests__/matcher.test.ts` | exact |
| `worker/src/__tests__/stitchedTranscript.test.ts` | test | — | `worker/src/__tests__/matcher.test.ts` | exact |
| `src/__tests__/status-view.test.tsx` | test | — | self (extend) | exact |

---

## Pattern Assignments

### `worker/src/contextExpander.ts` (utility, transform)

**Analog:** `worker/src/matcher.ts`

**Imports pattern** (matcher.ts lines 1–6):
```typescript
import type { TranscriptSegment, ClipMatch } from './types.js'
```
New file uses same import style with `.js` extension (ESM worker):
```typescript
import type { TranscriptSegment, ClipMatch } from './types.js'
```

**Module header pattern** (matcher.ts lines 1–8):
```typescript
/**
 * Transcript normalization and exact topic matching utilities for Phase 2.
 * Pure utility module — no side effects, no I/O.
 */
```

**Core pure-function pattern** (matcher.ts lines 27–63):
```typescript
export function findMatches(segments: TranscriptSegment[], topic: string): ClipMatch[] {
  // ...pure logic, no I/O, returns typed array
  return matches
}
```
New module follows same shape: named exports, typed parameters, typed return value, no side effects.

**New types to add** (derived from RESEARCH.md Pattern 1):
```typescript
export interface ExpandedWindow {
  startIdx: number  // index into TranscriptSegment[]
  endIdx: number
  startMs: number   // Math.round(segments[startIdx].offset * 1000)
  endMs: number     // Math.round((segments[endIdx].offset + segments[endIdx].duration) * 1000)
}

export const CONTEXT_WINDOW_MS = 30_000
```

**Core expansion function** (RESEARCH.md Pattern 1, lines 223–254):
```typescript
export function expandContextWindows(
  segments: TranscriptSegment[],
  matches: ClipMatch[],
  contextMs = CONTEXT_WINDOW_MS
): ExpandedWindow[] {
  return matches.map(match => {
    const innerStart = Math.min(...match.segmentIndices)
    const innerEnd   = Math.max(...match.segmentIndices)
    let leftIdx = innerStart, leftMs = 0
    while (leftIdx > 0 && leftMs < contextMs) {
      leftIdx--
      leftMs += Math.round(segments[leftIdx].duration * 1000)
    }
    let rightIdx = innerEnd, rightMs = 0
    while (rightIdx < segments.length - 1 && rightMs < contextMs) {
      rightIdx++
      rightMs += Math.round(segments[rightIdx].duration * 1000)
    }
    return {
      startIdx: leftIdx, endIdx: rightIdx,
      startMs: Math.round(segments[leftIdx].offset * 1000),
      endMs: Math.round((segments[rightIdx].offset + segments[rightIdx].duration) * 1000),
    }
  })
}
```

**Core merge function** (RESEARCH.md Pattern 2, lines 267–291):
```typescript
export function mergeOverlappingWindows(windows: ExpandedWindow[]): ExpandedWindow[] {
  if (windows.length === 0) return []
  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs)
  const merged: ExpandedWindow[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const curr = sorted[i]
    if (curr.startMs <= last.endMs) {
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

---

### `worker/src/stitchedTranscript.ts` (utility, transform)

**Analog:** `worker/src/matcher.ts`

**Imports pattern**:
```typescript
import type { TranscriptSegment } from './types.js'
import type { ExpandedWindow } from './contextExpander.js'
```

**New type to define**:
```typescript
export interface StitchedTranscriptEntry {
  sourceStartMs: number
  sourceEndMs: number
  text: string
}
```

**Core function** (RESEARCH.md Pattern 3, lines 307–323):
```typescript
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

---

### `worker/src/types.ts` (model — extend)

**Analog:** self

**Existing content** (lines 1–25 — read above). Add after `ClipMatch`:
```typescript
/**
 * A single entry in the stitched transcript, with source video timestamps.
 * Produced by buildStitchedTranscript() from MergedWindow[] in Phase 3.
 */
export interface StitchedTranscriptEntry {
  sourceStartMs: number  // Math.round(segment.offset * 1000)
  sourceEndMs: number    // Math.round((segment.offset + segment.duration) * 1000)
  text: string
}
```

---

### `worker/src/index.ts` (service — modify)

**Analog:** self

**Existing imports pattern** (lines 1–13):
```typescript
import { buildClipPlan } from './matcher.js'
import { Prisma } from '../../prisma/generated/prisma/client'
```
Add new imports after existing ones:
```typescript
import { expandContextWindows, mergeOverlappingWindows } from './contextExpander.js'
import { buildStitchedTranscript } from './stitchedTranscript.js'
```

**Existing insertion point** (lines 60–71 — the DONE update block):
```typescript
const clipPlan = buildClipPlan(segments, job.topic)
console.log(`  clipPlan: ${clipPlan.length} matches`)

console.log('  writing DONE...')
await prisma.job.update({
  where: { id: job.id },
  data: {
    transcript: segments as unknown as Prisma.InputJsonValue,
    clipPlan: clipPlan as unknown as Prisma.InputJsonValue,
    status: 'DONE',
  },
})
```
Phase 3 inserts between `buildClipPlan()` call and `prisma.job.update()`:
```typescript
const expandedWindows = expandContextWindows(segments, clipPlan)
const mergedWindows = mergeOverlappingWindows(expandedWindows)
const stitchedTranscript = buildStitchedTranscript(segments, mergedWindows)
console.log(`  stitchedTranscript: ${stitchedTranscript.length} entries`)
```
And adds `stitchedTranscript` to the update data using the established cast pattern:
```typescript
stitchedTranscript: stitchedTranscript as unknown as Prisma.InputJsonValue,
```

---

### `prisma/schema.prisma` (config — extend)

**Analog:** self

**Existing JSON column pattern** (lines 25–26):
```prisma
transcript   Json?
clipPlan     Json?
```
Add after `clipPlan`:
```prisma
stitchedTranscript  Json?
```
Full model block after change (RESEARCH.md Code Examples):
```prisma
model Job {
  id                  String    @id @default(uuid())
  userId              String
  youtubeUrl          String
  topic               String
  status              JobStatus @default(PENDING)
  errorMessage        String?
  transcript          Json?
  clipPlan            Json?
  stitchedTranscript  Json?     // Phase 3
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([userId])
}
```

---

### `src/types/job.ts` (model — extend)

**Analog:** self

**Existing interface pattern** (lines 1–49). Add new interface before `Job`:
```typescript
/**
 * A single entry in the stitched transcript, with source video timestamps.
 * Mirror of worker/src/types.ts StitchedTranscriptEntry — keep in sync.
 */
export interface StitchedTranscriptEntry {
  sourceStartMs: number
  sourceEndMs: number
  text: string
}
```
And extend `Job` interface (after `clipPlan`):
```typescript
stitchedTranscript: StitchedTranscriptEntry[] | null  // Phase 3
```

---

### `src/components/ui/tabs.tsx` (component — new, generated)

**Analog:** `src/components/ui/progress.tsx` (shadcn component using `@base-ui/react`)

**Generation command:**
```bash
npx shadcn add tabs
```
Do NOT hand-roll. Do NOT import from `@radix-ui/react-tabs` or `@base-ui/react/tabs` directly. The generated file uses `@base-ui/react` primitives consistent with the `base-nova` preset.

**Usage pattern** (RESEARCH.md Pattern 7):
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

<Tabs defaultValue="transcript">
  <TabsList>
    <TabsTrigger value="video">Video</TabsTrigger>
    <TabsTrigger value="transcript">Transcript</TabsTrigger>
    <TabsTrigger value="notes">Notes</TabsTrigger>
  </TabsList>
  <TabsContent value="video">...</TabsContent>
  <TabsContent value="transcript">...</TabsContent>
  <TabsContent value="notes">...</TabsContent>
</Tabs>
```

---

### `src/components/status-view.tsx` (component, event-driven — modify)

**Analog:** self

**Existing imports pattern** (lines 1–10):
```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { JobStatus } from '@/types/job'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
```
Add after existing imports:
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { StitchedTranscriptEntry } from '@/types/job'
import { cn } from '@/lib/utils'
```

**Existing props interface** (lines 24–29):
```typescript
interface StatusViewProps {
  userId: string
  initialStatus: string
  initialJobId: string
  initialErrorMessage: string | null
}
```
Extend with:
```typescript
initialStitchedTranscript: StitchedTranscriptEntry[] | null  // Phase 3
topic: string                                                 // Phase 3
```

**Existing Realtime handler** (lines 80–83):
```typescript
(payload: any) => {
  setStatus(payload.new.status)
  setErrorMessage(payload.new.errorMessage ?? null)
}
```
Add after `setErrorMessage`:
```typescript
setStitchedTranscript(payload.new.stitchedTranscript ?? null)
```

**Existing card width pattern** (line 151):
```tsx
<Card className="w-full max-w-md">
```
Change to conditional (Pitfall 4 from RESEARCH.md):
```tsx
<Card className={cn('w-full', isDone ? 'max-w-2xl' : 'max-w-md')}>
```

**Existing Done-state placeholder** (lines 173–177):
```tsx
{/* Done state placeholder — future phases will populate this */}
{isDone && (
  <p className="text-base text-muted-foreground">
    Your results are ready.
  </p>
)}
```
Replace with tab layout (RESEARCH.md Pattern 7 + Code Examples):
```tsx
{isDone && (
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
    </TabsContent>
    <TabsContent value="notes">
      <p className="text-base text-muted-foreground">
        Study notes will appear here in a future update.
      </p>
    </TabsContent>
  </Tabs>
)}
```

**Timestamp helper to add** (file-level, RESEARCH.md Pattern 8):
```typescript
function formatTimestamp(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  return `[${minutes}:${seconds}]`
}
```

---

### `src/app/status/page.tsx` (controller, request-response — modify)

**Analog:** self

**Existing buggy query** (lines 31–41):
```typescript
const job = await prisma.job.findFirst({
  where: {
    userId: user.id,
    status: {
      notIn: ['DONE', 'FAILED'],
    },
  },
  orderBy: { createdAt: 'desc' },
})
```
Fix: remove `status` filter (RESEARCH.md Pattern 5 + Pitfall 1):
```typescript
const job = await prisma.job.findFirst({
  where: { userId: user.id },
  orderBy: { createdAt: 'desc' },
})
```

**Existing StatusView render** (lines 61–67):
```tsx
<StatusView
  userId={user.id}
  initialStatus={job.status}
  initialJobId={job.id}
  initialErrorMessage={job.errorMessage ?? null}
/>
```
Extend with new props (RESEARCH.md Pattern 6):
```tsx
<StatusView
  userId={user.id}
  initialStatus={job.status}
  initialJobId={job.id}
  initialErrorMessage={job.errorMessage ?? null}
  initialStitchedTranscript={(job.stitchedTranscript as StitchedTranscriptEntry[] | null) ?? null}
  topic={job.topic}
/>
```
Also add import at top:
```typescript
import type { StitchedTranscriptEntry } from '@/types/job'
```

---

### `worker/src/__tests__/contextExpander.test.ts` (test — new)

**Analog:** `worker/src/__tests__/matcher.test.ts`

**Test file structure** (matcher.test.ts lines 1–5):
```typescript
import { describe, it, expect } from 'vitest'
import { normalize, findMatches, buildClipPlan } from '../matcher.js'
import type { TranscriptSegment } from '../types.js'
```
New file:
```typescript
import { describe, it, expect } from 'vitest'
import { expandContextWindows, mergeOverlappingWindows, CONTEXT_WINDOW_MS } from '../contextExpander.js'
import type { TranscriptSegment } from '../types.js'
import type { ClipMatch } from '../types.js'
```

**Test organization pattern** (matcher.test.ts lines 5–103):
```typescript
describe('functionName', () => {
  it('returns empty array when input is empty', () => { ... })
  it('handles the basic happy path', () => { ... })
  it('handles edge cases (boundary conditions)', () => { ... })
})
```

**Segment fixture pattern** (matcher.test.ts lines 33–35):
```typescript
const segments: TranscriptSegment[] = [
  { text: 'hello world', offset: 5, duration: 2, lang: 'en' },
]
```

**Required test cases for CLP-02 and CLP-03:**
- `expandContextWindows`: empty matches → empty result
- `expandContextWindows`: accumulates up to 30s left and right of match
- `expandContextWindows`: truncates silently at video start (leftIdx reaches 0)
- `expandContextWindows`: truncates silently at video end (rightIdx reaches segments.length - 1)
- `expandContextWindows`: result `startMs`/`endMs` derived from `offset` (not NaN)
- `mergeOverlappingWindows`: empty input → empty output
- `mergeOverlappingWindows`: non-overlapping windows stay separate
- `mergeOverlappingWindows`: overlapping windows merged into one (endMs = max of both)
- `mergeOverlappingWindows`: adjacent windows (curr.startMs === last.endMs) are merged

---

### `worker/src/__tests__/stitchedTranscript.test.ts` (test — new)

**Analog:** `worker/src/__tests__/matcher.test.ts`

**Imports**:
```typescript
import { describe, it, expect } from 'vitest'
import { buildStitchedTranscript } from '../stitchedTranscript.js'
import type { TranscriptSegment } from '../types.js'
import type { ExpandedWindow } from '../contextExpander.js'
```

**Required test cases for CLP-04 and STR-01:**
- Empty `mergedWindows` → empty array (STR-01: empty clipPlan case)
- Single window with one segment → one entry with correct `sourceStartMs`, `sourceEndMs`, `text`
- Single window with multiple segments → multiple entries in order
- `sourceStartMs` and `sourceEndMs` computed from `offset` (not NaN; CLP-04)
- Multiple non-adjacent windows → entries from all windows in order, no gap markers (D-05)

---

### `src/__tests__/status-view.test.tsx` (test — extend)

**Analog:** self

**Existing mock pattern** (lines 19–35):
```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({ on: () => ({ subscribe: vi.fn() }) }),
    removeChannel: vi.fn(),
  }),
}))
```
Keep existing mocks unchanged.

**Existing baseProps pattern** (lines 37–41):
```typescript
const baseProps = {
  userId: 'user-123',
  initialJobId: 'job-456',
  initialErrorMessage: null,
}
```
Extend for new required props:
```typescript
const baseProps = {
  userId: 'user-123',
  initialJobId: 'job-456',
  initialErrorMessage: null,
  initialStitchedTranscript: null,
  topic: 'machine learning',
}
```

**Existing render pattern** (lines 48–51):
```typescript
render(<StatusView {...baseProps} initialStatus="PENDING" />)
expect(screen.getByRole('progressbar')).toBeInTheDocument()
```

**New test cases to add for STR-02 and STR-03:**
```typescript
it('renders Transcript tab with entries in DONE state (STR-02)', () => {
  const entries = [
    { sourceStartMs: 64000, sourceEndMs: 67000, text: 'machine learning is here' },
  ]
  render(<StatusView {...baseProps} initialStatus="DONE" initialStitchedTranscript={entries} />)
  expect(screen.getByText('[1:04]')).toBeInTheDocument()
  expect(screen.getByText('machine learning is here')).toBeInTheDocument()
})

it('renders empty state message in Transcript tab when stitchedTranscript is empty (D-08)', () => {
  render(<StatusView {...baseProps} initialStatus="DONE" initialStitchedTranscript={[]} />)
  expect(screen.getByText(/No mentions of "machine learning" were found/)).toBeInTheDocument()
})

it('renders three tabs (Video, Transcript, Notes) in DONE state (D-06)', () => {
  render(<StatusView {...baseProps} initialStatus="DONE" />)
  expect(screen.getByRole('tab', { name: /video/i })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /transcript/i })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument()
})
```

---

## Shared Patterns

### Prisma JSON Cast
**Source:** `worker/src/index.ts` lines 67–69
**Apply to:** `worker/src/index.ts` (new `stitchedTranscript` field in update)
```typescript
stitchedTranscript: stitchedTranscript as unknown as Prisma.InputJsonValue,
```

### ESM Import Extensions
**Source:** `worker/src/matcher.ts` line 6
**Apply to:** All new worker modules (`contextExpander.ts`, `stitchedTranscript.ts`)
```typescript
import type { TranscriptSegment, ClipMatch } from './types.js'
// Note: always use .js extension for ESM imports in the worker
```

### JSX Text Node Safety (XSS prevention)
**Source:** `src/components/status-view.tsx` lines 169, 177
**Apply to:** `src/components/status-view.tsx` transcript rendering and topic in empty state
```tsx
// Safe: JSX text node — no dangerouslySetInnerHTML
<span className="text-base text-foreground">{entry.text}</span>
<p className="text-base text-muted-foreground">{topic}</p>
```

### Supabase Realtime State Update Pattern
**Source:** `src/components/status-view.tsx` lines 80–83
**Apply to:** `src/components/status-view.tsx` Realtime handler for `stitchedTranscript`
```typescript
(payload: any) => {
  setStatus(payload.new.status)
  setErrorMessage(payload.new.errorMessage ?? null)
  // Add:
  setStitchedTranscript(payload.new.stitchedTranscript ?? null)
}
```

### Security: userId-Scoped DB Query
**Source:** `src/app/status/page.tsx` lines 31–41
**Apply to:** `src/app/status/page.tsx` query fix
```typescript
// Scope to user's own job only — IDOR prevention (T-03-04)
where: { userId: user.id }
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/ui/tabs.tsx` | component | — | No existing tab component; must be generated via `npx shadcn add tabs`. Closest analog is `progress.tsx` for shadcn+base-ui structure. |

---

## Metadata

**Analog search scope:** `worker/src/`, `src/components/`, `src/app/`, `src/types/`, `prisma/`, `worker/src/__tests__/`, `src/__tests__/`
**Files scanned:** 10 source files read directly
**Pattern extraction date:** 2026-06-23
