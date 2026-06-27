# Phase 4: Stitched Video Output - Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 13 (7 new worker modules + 5 new test files + 1 new frontend test)
**Analogs found:** 11 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `worker/src/videoDownloader.ts` | service | file-I/O (stream-to-disk) | `worker/src/transcript.ts` | role-match |
| `worker/src/videoExtractor.ts` | service | file-I/O (spawn+file) | `worker/src/transcript.ts` | role-match |
| `worker/src/videoStitcher.ts` | service | file-I/O (spawn+file) | `worker/src/transcript.ts` | role-match |
| `worker/src/storageUploader.ts` | service | request-response | `worker/src/transcript.ts` | role-match |
| `worker/src/videoCleanup.ts` | service | batch | `worker/src/index.ts` (cleanup section) | partial |
| `worker/src/index.ts` (modify) | orchestrator | batch/pipeline | `worker/src/index.ts` (itself) | exact |
| `prisma/schema.prisma` (modify) | config | — | `prisma/schema.prisma` (itself, Phase 3 additions) | exact |
| `src/types/job.ts` (modify) | model | — | `src/types/job.ts` (itself, Phase 3 additions) | exact |
| `src/components/status-view.tsx` (modify) | component | event-driven | `src/components/status-view.tsx` (itself) | exact |
| `worker/src/__tests__/videoDownloader.test.ts` | test | — | `worker/src/__tests__/transcript.test.ts` | role-match |
| `worker/src/__tests__/videoExtractor.test.ts` | test | — | `worker/src/__tests__/stitchedTranscript.test.ts` | role-match |
| `worker/src/__tests__/videoStitcher.test.ts` | test | — | `worker/src/__tests__/stitchedTranscript.test.ts` | role-match |
| `worker/src/__tests__/storageUploader.test.ts` | test | — | `worker/src/__tests__/transcript.test.ts` | role-match |
| `worker/src/__tests__/videoCleanup.test.ts` | test | — | `worker/src/__tests__/stitchedTranscript.test.ts` | role-match |
| `src/__tests__/status-view-video-tab.test.tsx` | test | — | no analog (no React tests yet) | no analog |

---

## Pattern Assignments

### `worker/src/videoDownloader.ts` (service, file-I/O stream-to-disk)

**Analog:** `worker/src/transcript.ts`

**Imports pattern** (`worker/src/transcript.ts` lines 1–8):
```typescript
import {
  YoutubeTranscript,
  YoutubeTranscriptVideoUnavailableError,
  // ...
} from 'youtube-transcript-plus'
```
Apply the same named-import style for `@distube/ytdl-core`:
```typescript
import ytdl from '@distube/ytdl-core'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
```
Note: use `node:` prefix for all built-ins (established pattern in `worker/src/index.ts` lines 1–2, and throughout).

**Core pattern** (`worker/src/transcript.ts` lines 14–16 — re-throw all errors, caller maps them):
```typescript
export async function fetchTranscript(videoId: string) {
  return YoutubeTranscript.fetchTranscript(videoId, { retries: 2, retryDelay: 1000 })
}
```
Apply same "re-throw, caller maps" convention for `downloadYouTubeVideo`:
```typescript
export async function downloadYouTubeVideo(
  youtubeUrl: string,
  destPath: string,
): Promise<void> {
  const stream = ytdl(youtubeUrl, {
    filter: (fmt) => fmt.container === 'mp4' && fmt.hasVideo && fmt.hasAudio,
    quality: 'highest',
  })
  await pipeline(stream, createWriteStream(destPath))
}
```

**Error handling pattern** (`worker/src/transcript.ts` lines 22–39 — `mapTranscriptError`):
Create a parallel `mapVideoError(err: unknown): string` function following the same shape:
- `instanceof`-check specific errors → specific user message
- Fallback catch-all → generic message
- Single sentence, period at end, no jargon (Phase 1 D-11 convention)

**Guard pattern** (RESEARCH.md Pitfall 2):
```typescript
import ffmpegPath from 'ffmpeg-static'
if (!ffmpegPath) throw new Error('ffmpeg-static returned null — check installation')
```
Add this guard at module load time in `videoExtractor.ts`.

---

### `worker/src/videoExtractor.ts` (service, file-I/O spawn)

**Analog:** `worker/src/transcript.ts` (structure), RESEARCH.md Pattern 2 (FFmpeg spawn)

**Imports pattern:**
```typescript
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
import type { ExpandedWindow } from './contextExpander.js'
```
Note: all local imports use `.js` extension (established in `worker/src/index.ts` lines 10–14):
```typescript
import { fetchTranscript, mapTranscriptError } from './transcript.js'
import { extractYouTubeVideoId } from './youtube.js'
import { buildClipPlan } from './matcher.js'
```

**Core pattern** (RESEARCH.md Pattern 2 — direct spawn, never fluent-ffmpeg):
```typescript
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args)
    const stderr: string[] = []
    proc.stderr.on('data', (d: Buffer) => stderr.push(d.toString()))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.join('')}`))
    })
    proc.on('error', reject)
  })
}

export async function extractSegment(
  sourceFile: string,
  startMs: number,
  endMs: number,
  outputFile: string,
): Promise<void> {
  const startSec = (startMs / 1000).toFixed(3)
  const endSec   = (endMs / 1000).toFixed(3)
  await runFfmpeg([
    '-ss', startSec,
    '-to', endSec,
    '-i', sourceFile,
    '-c', 'copy',
    '-avoid_negative_ts', 'make_zero',
    '-y',
    outputFile,
  ])
}
```

**Error handling:** Same `throw new Error(...)` re-throw as `transcript.ts` — all errors bubble to `processPendingJob()`'s catch block in `index.ts` lines 81–88.

---

### `worker/src/videoStitcher.ts` (service, file-I/O spawn)

**Analog:** `worker/src/videoExtractor.ts` (shares `runFfmpeg` helper)

**Core pattern** (RESEARCH.md Pattern 3 — concat demuxer):
```typescript
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function stitchSegments(
  segmentPaths: string[],
  outputPath: string,
): Promise<void> {
  const filelistPath = path.join(path.dirname(outputPath), 'filelist.txt')
  const filelist = segmentPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join('\n')
  await writeFile(filelistPath, filelist, 'utf8')

  await runFfmpeg([
    '-f', 'concat',
    '-safe', '0',
    '-i', filelistPath,
    '-c', 'copy',
    '-y',
    outputPath,
  ])
}
```
Note: `runFfmpeg` is defined in `videoExtractor.ts` — either export it from there and import here, or define a shared `ffmpegRunner.ts` utility. Prefer the former to avoid an extra file.

---

### `worker/src/storageUploader.ts` (service, request-response)

**Analog:** `worker/src/transcript.ts` (structure — async export + re-throw)

**Imports pattern** (no existing Supabase admin client in worker; use `@supabase/supabase-js` directly):
```typescript
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
```

**Client init pattern** (RESEARCH.md Pattern 4; contrast with `src/lib/supabase/server.ts` which uses SSR client — worker uses plain admin client):
```typescript
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // bypasses RLS — never expose to browser
)
```

**Constants pattern** (mirrors `contextExpander.ts` line 9 `CONTEXT_WINDOW_MS = 30_000`):
```typescript
export const BUCKET = 'clip-videos'
export const RETENTION_MS = 24 * 60 * 60 * 1000   // 24h in ms (for videoExpiresAt)
const RETENTION_S  = RETENTION_MS / 1000            // 86400s (for createSignedUrl)
```

**Core pattern** (RESEARCH.md Pattern 4):
```typescript
export async function uploadVideoAndGetUrl(
  filePath: string,
  jobId: string,
): Promise<string> {
  const buffer = await readFile(filePath)
  const storagePath = `jobs/${jobId}/output.mp4`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: true })
  if (uploadError) throw uploadError

  const { data, error: urlError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, RETENTION_S)
  if (urlError || !data) throw urlError ?? new Error('No signed URL returned')

  return data.signedUrl
}
```

---

### `worker/src/videoCleanup.ts` (service, batch)

**Analog:** `worker/src/index.ts` (Prisma usage pattern, lines 42–91)

**Imports pattern** (mirrors index.ts — Prisma instance passed in or imported from a shared module):
```typescript
import type { PrismaClient } from '../../prisma/generated/prisma/client'
import { supabaseAdmin, BUCKET } from './storageUploader.js'
```

**Prisma query pattern** (`worker/src/index.ts` lines 43, 71–79 — `findFirst`, `update`):
```typescript
// Extend the pattern to findMany + updateMany for batch cleanup
const expired = await prisma.job.findMany({
  where: {
    videoExpiresAt: { lt: new Date() },
    videoUrl: { not: null },
  },
  select: { id: true },
  take: CLEANUP_BATCH_LIMIT,   // 10 — avoid full-table scan on every 4s tick
})
```

**Core pattern** (RESEARCH.md Pattern 6):
```typescript
const CLEANUP_BATCH_LIMIT = 10

export async function cleanupExpiredVideos(prisma: PrismaClient): Promise<void> {
  const expired = await prisma.job.findMany({
    where: { videoExpiresAt: { lt: new Date() }, videoUrl: { not: null } },
    select: { id: true },
    take: CLEANUP_BATCH_LIMIT,
  })
  if (expired.length === 0) return

  const storagePaths = expired.map((j) => `jobs/${j.id}/output.mp4`)
  await supabaseAdmin.storage.from(BUCKET).remove(storagePaths)

  await prisma.job.updateMany({
    where: { id: { in: expired.map((j) => j.id) } },
    data: { videoUrl: null, videoExpiresAt: null },
  })
}
```

---

### `worker/src/index.ts` (modify — orchestrator, pipeline)

**Analog:** Itself. Only the following sections change.

**Import additions** (follow existing import block lines 10–15 — `.js` extension, named imports):
```typescript
import { downloadYouTubeVideo } from './videoDownloader.js'
import { extractSegments } from './videoExtractor.js'
import { stitchSegments } from './videoStitcher.js'
import { uploadVideoAndGetUrl, RETENTION_MS } from './storageUploader.js'
import { cleanupExpiredVideos } from './videoCleanup.js'
import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
```

**Temp dir lifecycle pattern** (RESEARCH.md Pattern 5 — `withTempDir`):
```typescript
async function withTempDir<T>(
  jobId: string,
  fn: (tmpDir: string) => Promise<T>,
): Promise<T> {
  const tmpDir = path.join(os.tmpdir(), `clip-that-${jobId}`)
  await mkdir(tmpDir, { recursive: true })
  try {
    return await fn(tmpDir)
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
```

**Pipeline extension in `processPendingJob()`** (insert after line 68 `buildStitchedTranscript`, before line 71 `prisma.job.update`):
```typescript
// Phase 4: video pipeline
const videoId = extractYouTubeVideoId(job.youtubeUrl)!
const videoUrl = await withTempDir(job.id, async (tmpDir) => {
  const sourceFile    = path.join(tmpDir, 'source.mp4')
  const outputFile    = path.join(tmpDir, 'output.mp4')

  console.log('  downloading source video...')
  await downloadYouTubeVideo(`https://www.youtube.com/watch?v=${videoId}`, sourceFile)

  console.log('  extracting segments...')
  const segmentFiles = await extractSegments(mergedWindows, sourceFile, tmpDir)

  console.log('  stitching segments...')
  await stitchSegments(segmentFiles, outputFile)

  console.log('  uploading to Supabase Storage...')
  return await uploadVideoAndGetUrl(outputFile, job.id)
})
```

**`prisma.job.update` extension** (lines 71–79 — add two new fields to data):
```typescript
await prisma.job.update({
  where: { id: job.id },
  data: {
    transcript:         segments as unknown as Prisma.InputJsonValue,
    clipPlan:           clipPlan as unknown as Prisma.InputJsonValue,
    stitchedTranscript: stitchedTranscript as unknown as Prisma.InputJsonValue,
    videoUrl,                                           // Phase 4
    videoExpiresAt: new Date(Date.now() + RETENTION_MS), // Phase 4
    status: 'DONE',
  },
})
```

**`main()` loop extension** (add cleanup call each tick, lines 97–103):
```typescript
while (!shutdown) {
  tick++
  process.stdout.write(`[tick ${tick}] polling... `)
  await cleanupExpiredVideos(prisma)   // Phase 4 — before or after processPendingJob
  await processPendingJob()
  process.stdout.write('done\n')
  await sleep(4000)
}
```

---

### `prisma/schema.prisma` (modify — config)

**Analog:** Itself. Add two fields after `stitchedTranscript` (line 28), matching Phase 3's comment style:
```prisma
model Job {
  // ... existing fields ...
  stitchedTranscript Json?      // Phase 3
  videoUrl           String?    // Phase 4: Supabase Storage signed URL
  videoExpiresAt     DateTime?  // Phase 4: expiry for worker cleanup pass
  // ...
}
```
After editing, run `npx prisma migrate dev --name add-video-url-and-expires`.

---

### `src/types/job.ts` (modify — model)

**Analog:** Itself. Add two fields after `stitchedTranscript` (line 57), matching Phase 3 comment style:
```typescript
export interface Job {
  // ... existing fields ...
  stitchedTranscript: StitchedTranscriptEntry[] | null  // Phase 3
  videoUrl:           string | null                      // Phase 4
  videoExpiresAt:     string | null                      // Phase 4 (ISO string, DateTime serialised)
  createdAt: string
  updatedAt: string
}
```

---

### `src/components/status-view.tsx` (modify — component, event-driven)

**Analog:** Itself. Three targeted changes following existing patterns.

**Props extension** (after `initialStitchedTranscript` in `StatusViewProps`, line 43–44):
```typescript
interface StatusViewProps {
  userId: string
  initialStatus: string
  initialJobId: string
  initialErrorMessage: string | null
  initialStitchedTranscript: StitchedTranscriptEntry[] | null
  initialVideoUrl: string | null    // Phase 4
  topic: string
}
```

**State addition** (after `stitchedTranscript` state, line 73):
```typescript
const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl ?? null)
```

**Realtime payload handler extension** (lines 103–107 — add `setVideoUrl` call):
```typescript
(payload: any) => {
  setStatus(payload.new.status)
  setErrorMessage(payload.new.errorMessage ?? null)
  setStitchedTranscript(payload.new.stitchedTranscript ?? null)
  setVideoUrl(payload.new.videoUrl ?? null)             // Phase 4
}
```

**Polling fallback extension** (lines 127–137 — extend select and update):
```typescript
const { data } = await supabase
  .from('Job')
  .select('status, errorMessage, stitchedTranscript, videoUrl')  // add videoUrl
  .eq('id', initialJobId)
  .single()

if (data) {
  const row = data as any
  setStatus(row.status)
  setErrorMessage(row.errorMessage ?? null)
  setStitchedTranscript(parseStitchedTranscript(row.stitchedTranscript))
  setVideoUrl(row.videoUrl ?? null)                               // Phase 4
}
```

**Video tab content** (lines 232–236 — replace placeholder `<p>` with conditional player per D-08/D-09):
```tsx
<TabsContent value="video">
  {!videoUrl && (stitchedTranscript?.length ?? 0) === 0 ? (
    <p className="text-base text-muted-foreground">
      No clips found for &quot;{topic}&quot;.
    </p>
  ) : videoUrl ? (
    <video
      controls
      src={videoUrl}
      className="w-full rounded-md"
    />
  ) : (
    <p className="text-base text-muted-foreground">
      Working on it...
    </p>
  )}
</TabsContent>
```

---

## Test File Patterns

### `worker/src/__tests__/videoDownloader.test.ts`

**Analog:** `worker/src/__tests__/transcript.test.ts`

**Test file structure** (lines 1–2, 11–12 — pure unit, no I/O mocking needed for `mapTranscriptError`):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadYouTubeVideo } from '../videoDownloader.js'
```
For I/O-bound functions, use `vi.mock`:
```typescript
vi.mock('@distube/ytdl-core', () => ({
  default: vi.fn(),
}))
vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(() => ({})),
}))
```

**Test body style** (mirrors `stitchedTranscript.test.ts` lines 6–26 — `describe` + `it` + `expect`):
```typescript
describe('downloadYouTubeVideo', () => {
  it('calls pipeline with ytdl stream and write stream', async () => {
    // arrange mocks, call function, assert on mock calls
  })
  it('throws when pipeline rejects', async () => {
    // mock pipeline to reject, expect throw
  })
})
```

### `worker/src/__tests__/videoExtractor.test.ts` and `videoStitcher.test.ts`

**Analog:** `worker/src/__tests__/stitchedTranscript.test.ts`

Mock `child_process.spawn`:
```typescript
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    stderr: { on: vi.fn() },
    on: vi.fn((event, cb) => { if (event === 'close') cb(0) }),
    on error: vi.fn(),
  })),
}))
```

### `worker/src/__tests__/storageUploader.test.ts`

Mock Supabase client:
```typescript
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}))
```

### `worker/src/__tests__/videoCleanup.test.ts`

**Analog:** `worker/src/__tests__/stitchedTranscript.test.ts` (structure)

Mock Prisma:
```typescript
const mockPrisma = {
  job: {
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}
```

---

## Shared Patterns

### Error Mapping Convention
**Source:** `worker/src/transcript.ts` lines 22–39
**Apply to:** `videoDownloader.ts`, `videoExtractor.ts`, `videoStitcher.ts`, `storageUploader.ts`

All worker service modules follow the same error mapping pattern: a `mapXxxError(err: unknown): string` function with `instanceof` guards returning user-facing single-sentence messages (D-11 convention). The `processPendingJob()` catch block in `index.ts` calls this function before writing `FAILED` status.

```typescript
// Pattern from transcript.ts lines 22–39
export function mapVideoError(err: unknown): string {
  // instanceof checks for specific error types → specific messages
  return "Failed to process video. Please try again."  // catch-all
}
```

### Local Import `.js` Extension
**Source:** `worker/src/index.ts` lines 10–15
**Apply to:** All new worker files

All worker-internal imports use `.js` extension even though files are `.ts`. ESM resolution requirement:
```typescript
import { buildStitchedTranscript } from './stitchedTranscript.js'
import { downloadYouTubeVideo } from './videoDownloader.js'
```

### `node:` Built-in Prefix
**Source:** `worker/src/index.ts` lines 1–2 (`import dns from 'node:dns'`)
**Apply to:** All new worker files

All Node.js built-in imports use the `node:` protocol prefix:
```typescript
import { spawn } from 'node:child_process'
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import os from 'node:os'
import path from 'node:path'
```

### Prisma `as unknown as Prisma.InputJsonValue` Cast
**Source:** `worker/src/index.ts` lines 74–76
**Apply to:** Any new JSON columns written in Phase 4 (none — `videoUrl` is String?, not Json?)

```typescript
// String? and DateTime? fields do NOT need this cast — only Json? columns do
videoUrl,                                            // plain string — no cast needed
videoExpiresAt: new Date(Date.now() + RETENTION_MS), // plain Date — no cast needed
```

### Supabase Realtime Payload Extension
**Source:** `src/components/status-view.tsx` lines 103–107
**Apply to:** `status-view.tsx` Realtime handler and polling fallback

The payload handler already sets multiple fields in one callback. Extend it — do not create a second `useEffect` or channel subscription for `videoUrl`.

### Test `vi.mock` at Module Top Level
**Source:** Established Vitest pattern (no existing I/O mock tests yet in this codebase)
**Apply to:** All 5 new worker test files

`vi.mock(...)` calls must be at the top level of the test file (not inside `describe` or `beforeEach`). Vitest hoists them automatically.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/__tests__/status-view-video-tab.test.tsx` | test (React) | — | No React Testing Library tests exist in the codebase yet; RESEARCH.md recommends `@testing-library/react` which is already in devDependencies |

**Guidance for planner:** For `status-view-video-tab.test.tsx`, use the RESEARCH.md pattern (pass `videoUrl` as prop or mock Realtime payload; assert `<video>` element rendered with correct `src`). Check `package.json` devDependencies for `@testing-library/react` version before writing the test.

---

## Metadata

**Analog search scope:** `worker/src/`, `worker/src/__tests__/`, `src/components/`, `src/types/`, `src/lib/supabase/`, `prisma/`
**Files read:** 12
**Pattern extraction date:** 2026-06-25
