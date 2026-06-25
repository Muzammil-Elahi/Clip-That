# Phase 4: Stitched Video Output - Research

**Researched:** 2026-06-25
**Domain:** YouTube video download, FFmpeg segment extraction/stitching, Supabase Storage, HTML5 video playback
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Free tiers only — all services and tools used in Phase 4 must be free or on a free tier plan. No paid infrastructure (no AWS S3, no paid Cloudflare R2, no paid video CDN). Hard constraint for Phase 4 and all subsequent phases.
- **D-02:** YouTube video retrieval library — `@distube/ytdl-core` (active Node.js fork of ytdl-core). Node-only install, no Railway system package or binary configuration required. Same install pattern as `youtube-transcript-plus` already in the worker. If YouTube anti-bot measures degrade reliability later, `yt-dlp` is the upgrade path.
- **D-03:** FFmpeg binary — Claude's discretion (e.g., `ffmpeg-static` npm package which bundles a pre-built FFmpeg binary, or `@ffmpeg-installer/ffmpeg`). Must work on Railway without manual system package setup. `fluent-ffmpeg` wrapper or direct `child_process` spawn is Claude's discretion.
- **D-04:** Storage backend — Supabase Storage (already in the stack, free tier: 1GB storage / 2GB bandwidth, sufficient for MVP). The worker uploads the stitched `.mp4` to a Supabase Storage bucket, then stores the resulting signed URL on the Job record (`videoUrl String?`). The browser plays the video directly from the signed URL.
- **D-05:** Prisma schema additions — Add `videoUrl String?` (the Supabase Storage signed URL) and `videoExpiresAt DateTime?` (set to now + retention window, e.g., 24h) to the Job model. Requires a Prisma migration.
- **D-06:** Expiration mechanism — Worker cleanup pass on each polling tick. The worker's existing polling loop already runs every 4 seconds. On each tick, before or after checking for PENDING jobs, query for jobs where `videoExpiresAt` is in the past and `videoUrl` is non-null, delete their Supabase Storage files, and null `videoUrl`. No separate cron process or infrastructure needed.
- **D-07:** Retention window — Claude's discretion (24h is a reasonable default; use a configurable constant in the worker). The window starts at job completion.
- **D-08:** Video player — HTML5 `<video>` with native browser controls (`<video controls src={videoUrl} className="w-full rounded-md" />`). No new player library dependencies. The `videoUrl` field flows to `status-view.tsx` via Supabase Realtime the same way `stitchedTranscript` already does — add `videoUrl` to the Realtime payload and the existing polling fallback.
- **D-09:** Video tab states — The Video tab shows: "Working on it..." while job is PENDING/PROCESSING (existing behavior), the `<video>` player once `videoUrl` arrives on the DONE event, and a "No clips found" message when `stitchedTranscript` is empty (no matches → no video). Tab remains visible in all DONE states.

### Claude's Discretion

- FFmpeg wrapper choice (fluent-ffmpeg vs direct child_process)
- FFmpeg binary package (ffmpeg-static, @ffmpeg-installer/ffmpeg, or similar)
- Supabase Storage bucket name and file path convention
- Exact retention window constant value (24h recommended default)
- Worker cleanup query batching / limit to avoid scanning all rows on every tick
- FFmpeg concat filter vs demuxer for segment stitching
- Prisma field names (videoUrl, videoExpiresAt, or similar)

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VID-01 | System can extract planned video segments from the source YouTube video | D-02 (@distube/ytdl-core download) + D-03 (FFmpeg -ss/-to extraction) |
| VID-02 | System can stitch all planned segments into one continuous video | FFmpeg concat demuxer with -c copy; all segments from same source so codecs match |
| VID-03 | User can play the stitched video in the browser | D-08 HTML5 `<video>` tag with native controls; signed URL from Supabase Storage |
| VID-04 | System can avoid storing processed video artifacts permanently | D-04/D-05/D-06: videoExpiresAt + worker cleanup pass deletes Supabase Storage files |
| JOB-03 | System can expire anonymous job artifacts after a configured retention window | D-06 + D-07: 24h RETENTION_MS constant, cleanup on each polling tick |

</phase_requirements>

---

## Summary

Phase 4 implements the full media pipeline: download source video from YouTube, extract N segments via FFmpeg, stitch them into one `.mp4`, upload to Supabase Storage, persist the signed URL on the Job row, and play it in the browser. A cleanup pass on each polling tick deletes artifacts whose `videoExpiresAt` has passed.

The key architectural decision for Claude's discretion is **direct `child_process.spawn` with `ffmpeg-static`** (no fluent-ffmpeg wrapper). `fluent-ffmpeg` is deprecated on npm as of 2024 and should not be used. FFmpeg commands are simple enough that direct spawn is more transparent and maintainable. The **concat demuxer** (`-f concat -safe 0 -i filelist.txt -c copy`) is the right stitching method because all segments come from the same YouTube source (same codec/resolution), enabling stream-copy speed with no re-encoding.

A critical risk to surface: `@distube/ytdl-core` was **archived August 16, 2025** and is no longer maintained by its authors, who recommend `youtubei.js` instead. D-02 locks in this package and the project's yt-dlp upgrade path is documented. The package still installs and may still function, but breakage from YouTube anti-bot changes will receive no upstream patches. The planner should note this explicitly.

**Primary recommendation:** Use `ffmpeg-static` + direct `child_process.spawn` for FFmpeg; use `@distube/ytdl-core` as locked in D-02 but flag the archival risk; use `@supabase/supabase-js` admin client (service role key) for Storage upload + signed URL; write a `cleanupExpiredVideos()` function called on each polling tick.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| YouTube video download | Worker (Railway) | — | Node.js stream API; must happen server-side to avoid CORS and rate limits |
| FFmpeg segment extraction | Worker (Railway) | — | Binary execution; not possible in browser; file I/O requires server |
| FFmpeg segment stitching | Worker (Railway) | — | Same pipeline stage as extraction; concat demuxer runs on same temp files |
| Supabase Storage upload | Worker (Railway) | — | Service role key must never reach browser; upload after stitching |
| Artifact expiration/cleanup | Worker (Railway) | — | Polling loop already runs there; Prisma + Supabase Storage delete calls |
| Prisma schema (videoUrl, videoExpiresAt) | Database (Supabase) | Worker writes | Columns added via migration; worker writes on job completion |
| Signed URL generation | Worker (Railway) | — | createSignedUrl must use service role key, called immediately before persisting URL |
| videoUrl propagation to browser | Supabase Realtime | Polling fallback | Same channel subscription as stitchedTranscript; extend payload handler |
| Video playback | Browser / Client | — | HTML5 `<video>` with native controls; no custom player |
| Video tab state management | Browser / Client | — | status-view.tsx already handles PENDING/PROCESSING/DONE/FAILED; add videoUrl state |

---

## Standard Stack

### Core (Worker additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ffmpeg-static` | 5.3.0 | Provides pre-built FFmpeg binary path | Zero system config on Railway; statically linked binary; 1.2M downloads/week [VERIFIED: npm registry] |
| `@distube/ytdl-core` | 4.16.12 | YouTube video stream download | Locked in D-02; active Node.js fork of ytdl-core; 82K downloads/week — **WARNING: archived Aug 2025** [VERIFIED: npm registry] |
| `@supabase/supabase-js` | 2.108.2 (already installed) | Storage upload + signed URL | Already in project stack; service role client bypasses RLS for worker uploads [ASSUMED] |
| Node.js built-ins: `child_process`, `fs`, `os`, `path` | v22 (current) | Spawn FFmpeg, manage temp files | No additional install; `os.tmpdir()` for temp directory [ASSUMED] |

### Not Installed / Not Needed

| Package | Verdict | Reason |
|---------|---------|--------|
| `fluent-ffmpeg` | DEPRECATED (SUS) | Official npm deprecation notice; do not use |
| `@ffmpeg-installer/ffmpeg` | Available (OK) | Alternative binary provider; ffmpeg-static preferred (simpler API) |
| `ytdlp-nodejs` | SLOP — REMOVED | Suspicious postinstall script flagged by legitimacy gate |
| `youtube-dl-exec` | SUS | Postinstall script present; requires Python; more complexity than needed |

### Frontend (no new packages)

The Video tab is an extension of the existing `status-view.tsx`. No new npm packages are needed in the Next.js app — HTML5 `<video>` is native.

### Installation (worker)

```bash
# From project root, in the worker directory:
cd worker
npm install ffmpeg-static @distube/ytdl-core
npm install --save-dev @types/ffmpeg-static
```

**Version verification (run before installing):**
```bash
npm view ffmpeg-static version        # confirmed 5.3.0 as of 2026-06-25
npm view @distube/ytdl-core version   # confirmed 4.16.12 as of 2026-06-25
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----|-------------|-------------|---------|-------------|
| `@distube/ytdl-core` | npm | ~2 yrs | 81,858 | github.com/distubejs/ytdl-core | OK* | Approved — **see warning** |
| `ffmpeg-static` | npm | ~8 yrs | 1,191,351 | github.com/eugeneware/ffmpeg-static | OK | Approved |
| `fluent-ffmpeg` | npm | ~10 yrs | 2,038,464 | github.com/fluent-ffmpeg | SUS (deprecated) | REJECTED — do not use |
| `@supabase/supabase-js` | npm | active | 21,579,050 | github.com/supabase/supabase-js | SUS (too-new signal) | Approved — already in stack |
| `ytdlp-nodejs` | npm | 5 mo | 5,857 | github.com/iqbal-rashed/ytdlp-nodejs | SLOP | REMOVED — suspicious postinstall |
| `youtube-dl-exec` | npm | active | 82,597 | github.com/microlinkhq/youtube-dl-exec | SUS | Not used — not needed |

**\* @distube/ytdl-core warning:** Repository was **archived August 16, 2025** — no longer maintained. The package still exists on npm at v4.16.12 and is locked by D-02. Planner should document that if YouTube breaks the downloader, `yt-dlp` via a vetted wrapper (or `youtubei.js`) is the upgrade path per CONTEXT.md.

**Packages removed due to SLOP verdict:** `ytdlp-nodejs`
**Packages rejected due to DEPRECATED verdict:** `fluent-ffmpeg`
**Packages flagged SUS (already in stack, proceed):** `@supabase/supabase-js`

---

## Architecture Patterns

### System Architecture Diagram

```
[Browser]
   |
   | submit job
   v
[Next.js Server Action] --> [Prisma: Job INSERT (PENDING)]
                                 |
                    [Supabase Realtime subscription]
                                 |
                    [Railway Worker — polling loop, every 4s]
                        |
                        | tick N: processPendingJob()
                        |
                        +--> fetchTranscript() [Phase 2]
                        +--> buildClipPlan()   [Phase 2]
                        +--> expandContextWindows() + mergeOverlappingWindows() [Phase 3]
                        +--> buildStitchedTranscript()  [Phase 3]
                        |
                        +--> [Phase 4 pipeline — new]
                              |
                              +--> downloadYouTubeVideo(videoId)
                              |        @distube/ytdl-core
                              |        stream -> /tmp/<jobId>/source.mp4
                              |
                              +--> extractSegments(mergedWindows, sourceFile)
                              |        FFmpeg -ss/-to per window
                              |        child_process.spawn(ffmpegPath, [...])
                              |        outputs: /tmp/<jobId>/segment-0.mp4, segment-1.mp4, ...
                              |
                              +--> stitchSegments(segmentFiles)
                              |        FFmpeg concat demuxer
                              |        filelist.txt -> /tmp/<jobId>/output.mp4
                              |
                              +--> uploadToSupabase(outputFile, jobId)
                              |        supabase.storage.from('videos').upload(...)
                              |        createSignedUrl(path, 86400)
                              |
                              +--> prisma.job.update({ videoUrl, videoExpiresAt, status: DONE })
                              |
                              +--> fs.rm(tmpDir, { recursive: true })  [cleanup]
                        |
                        | tick N: cleanupExpiredVideos() [runs every tick]
                              |
                              +--> prisma.job.findMany({ videoExpiresAt < now })
                              +--> supabase.storage.from('videos').remove([paths])
                              +--> prisma.job.updateMany({ videoUrl: null, videoExpiresAt: null })
                        |
              [Supabase Realtime push: videoUrl on Job UPDATE]
                        |
              [Browser status-view.tsx]
                        |
                        +--> state: videoUrl arrived
                        +--> <video controls src={videoUrl} />
```

### Recommended Project Structure

```
worker/src/
├── index.ts              # Extend processPendingJob(); add cleanupExpiredVideos() call per tick
├── videoDownloader.ts    # NEW: downloadYouTubeVideo(videoId, destPath): Promise<void>
├── videoExtractor.ts     # NEW: extractSegments(windows, srcPath, tmpDir): Promise<string[]>
├── videoStitcher.ts      # NEW: stitchSegments(segmentPaths, outPath): Promise<void>
├── storageUploader.ts    # NEW: uploadVideoAndGetUrl(filePath, jobId): Promise<string>
├── videoCleanup.ts       # NEW: cleanupExpiredVideos(): Promise<void>
├── types.ts              # Extend: no new types needed (ExpandedWindow already covers windows)
└── __tests__/
    ├── videoDownloader.test.ts   # unit — mock ytdl stream
    ├── videoExtractor.test.ts    # unit — mock child_process.spawn
    ├── videoStitcher.test.ts     # unit — mock child_process.spawn
    ├── storageUploader.test.ts   # unit — mock supabase client
    └── videoCleanup.test.ts      # unit — mock prisma + supabase

src/components/
└── status-view.tsx       # Extend: add videoUrl state, update Realtime handler, add <video> in Video tab

src/types/
└── job.ts                # Extend: add videoUrl: string | null, videoExpiresAt: string | null

prisma/
└── schema.prisma         # Extend Job model: videoUrl String?, videoExpiresAt DateTime?
```

### Pattern 1: YouTube Download via @distube/ytdl-core

**What:** Stream YouTube video to a temp file using ESM import.
**When to use:** At the start of the Phase 4 pipeline, before FFmpeg segment extraction.

```typescript
// Source: @distube/ytdl-core npm README + ESM pattern
import ytdl from '@distube/ytdl-core'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

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

**Notes:**
- `pipeline` from `node:stream/promises` handles backpressure and rejects on error — use this instead of `.pipe()` which swallows errors [ASSUMED]
- Filter `container === 'mp4'` ensures FFmpeg can read without remux; fall back to removing container filter if no mp4 format exists for a given video
- D-02 specifies this library; do not swap to youtubei.js without updating CONTEXT.md

### Pattern 2: FFmpeg Segment Extraction via child_process.spawn

**What:** Extract one video segment using FFmpeg `-ss`/`-to` and stream copy.
**When to use:** For each `ExpandedWindow` from `mergeOverlappingWindows()`.

```typescript
// Source: FFmpeg docs + Node.js child_process pattern [ASSUMED]
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

export function runFfmpeg(args: string[]): Promise<void> {
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

// Extract one segment: startMs/endMs in milliseconds
export async function extractSegment(
  sourceFile: string,
  startMs: number,
  endMs: number,
  outputFile: string,
): Promise<void> {
  const startSec = (startMs / 1000).toFixed(3)
  const endSec   = (endMs / 1000).toFixed(3)
  await runFfmpeg([
    '-ss', startSec,          // seek BEFORE -i (fast, keyframe-aligned)
    '-to', endSec,
    '-i', sourceFile,
    '-c', 'copy',             // stream copy — no re-encode
    '-avoid_negative_ts', 'make_zero',
    '-y',                     // overwrite output
    outputFile,
  ])
}
```

**Keyframe alignment note:** `-c copy` snaps to nearest keyframe. For a 30fps video with 2s GOP, actual start may be 0–2s early. This is acceptable for lecture clips where transcript timestamps already have ~1s granularity. If precision becomes important, replace `-c copy` with `-c:v libx264 -c:a aac` at the cost of significant CPU time.

### Pattern 3: FFmpeg Concat Demuxer for Stitching

**What:** Stitch multiple extracted segment files into one output file.
**When to use:** After all segments are extracted.

```typescript
// Source: FFmpeg concat demuxer docs [ASSUMED]
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function stitchSegments(
  segmentPaths: string[],
  outputPath: string,
): Promise<void> {
  // Write filelist.txt — required by concat demuxer
  const filelistPath = path.join(path.dirname(outputPath), 'filelist.txt')
  const filelist = segmentPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join('\n')
  await writeFile(filelistPath, filelist, 'utf8')

  await runFfmpeg([
    '-f', 'concat',
    '-safe', '0',             // allow absolute paths
    '-i', filelistPath,
    '-c', 'copy',
    '-y',
    outputPath,
  ])
}
```

**Why concat demuxer (not concat filter):** All segments come from the same YouTube source — same codec (H.264/AAC), same resolution, same framerate. Concat demuxer with `-c copy` stitches in milliseconds (I/O bound). Concat filter requires full re-encode (minutes for a 60min lecture) and is unnecessary when inputs match. [ASSUMED]

### Pattern 4: Supabase Storage Upload + Signed URL

**What:** Upload stitched mp4 to Supabase Storage using the service role key, then create a signed URL.
**When to use:** After stitching succeeds.

```typescript
// Source: Supabase docs [ASSUMED — exact API verified by project's existing usage]
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // bypasses RLS
)

const BUCKET = 'clip-videos'
const RETENTION_S = 24 * 60 * 60  // 86400 seconds = 24 hours

export async function uploadVideoAndGetUrl(
  filePath: string,
  jobId: string,
): Promise<string> {
  const buffer = await readFile(filePath)
  const storagePath = `jobs/${jobId}/output.mp4`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'video/mp4',
      upsert: true,
    })
  if (uploadError) throw uploadError

  const { data, error: urlError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, RETENTION_S)
  if (urlError || !data) throw urlError ?? new Error('No signed URL returned')

  return data.signedUrl
}
```

**Notes:**
- `createSignedUrl` `expiresIn` is in **seconds** (not milliseconds) [ASSUMED from docs]
- The signed URL is what gets stored as `videoUrl` on the Job row
- `SUPABASE_SERVICE_ROLE_KEY` must be added to worker's `.env.local` and Railway env vars — never exposed to the browser
- Bucket `clip-videos` must be created in Supabase dashboard (private bucket, no public access)
- File path convention: `jobs/{jobId}/output.mp4` — jobId is already a UUID from Prisma

### Pattern 5: Temp File Lifecycle

**What:** Create job-scoped temp directory, clean up in `finally` after upload.
**When to use:** In `processPendingJob()` for the Phase 4 pipeline steps.

```typescript
// Source: Node.js os.tmpdir() + fs.rm [ASSUMED]
import os from 'node:os'
import path from 'node:path'
import { mkdir, rm } from 'node:fs/promises'

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

### Pattern 6: Worker Polling Cleanup Pass

**What:** On each tick, query for expired artifacts and delete them from Supabase Storage.
**When to use:** In `main()` loop, once per tick, alongside `processPendingJob()`.

```typescript
// Source: Established worker pattern from index.ts [ASSUMED]
const CLEANUP_BATCH_LIMIT = 10  // avoid full-table scans on every tick

async function cleanupExpiredVideos(): Promise<void> {
  const expired = await prisma.job.findMany({
    where: {
      videoExpiresAt: { lt: new Date() },
      videoUrl: { not: null },
    },
    select: { id: true },
    take: CLEANUP_BATCH_LIMIT,
  })
  if (expired.length === 0) return

  // Delete storage files
  const storagePaths = expired.map((j) => `jobs/${j.id}/output.mp4`)
  await supabaseAdmin.storage.from(BUCKET).remove(storagePaths)

  // Null out the URL fields
  await prisma.job.updateMany({
    where: { id: { in: expired.map((j) => j.id) } },
    data: { videoUrl: null, videoExpiresAt: null },
  })
}
```

**Batch limit:** `take: CLEANUP_BATCH_LIMIT` prevents scanning all rows on every 4s tick. 10 is sufficient for MVP; increase if volume grows.

### Anti-Patterns to Avoid

- **Using fluent-ffmpeg:** It is deprecated on npm. Use direct `child_process.spawn` with the `ffmpegPath` from `ffmpeg-static`.
- **Using `pipe()` without error handling:** Node.js `.pipe()` swallows stream errors. Use `node:stream/promises`'s `pipeline()` instead.
- **Reading entire video into memory before FFmpeg:** For large source videos (1h+), loading into a Buffer causes OOM. Download to a temp file first, then pass the file path to FFmpeg.
- **Using the anon key for Storage uploads in the worker:** The anon key is subject to RLS; use `SUPABASE_SERVICE_ROLE_KEY` in the worker client. Never expose this key to the browser.
- **Re-encoding when concat demuxer suffices:** All segments from the same source will have matching codecs. `-c copy` finishes in seconds; libx264 re-encode takes minutes. Avoid re-encoding unless codec mismatch is detected.
- **Not cleaning up temp files on FFmpeg failure:** Wrap all FFmpeg calls in `withTempDir()` so the `finally` block always runs.
- **Hardcoding 24h in seconds as a magic number:** Use a named constant `RETENTION_MS = 24 * 60 * 60 * 1000` (for `videoExpiresAt` calculation) and `RETENTION_S = RETENTION_MS / 1000` (for `createSignedUrl`).
- **Storing `videoExpiresAt` offset from signed URL expiry rather than from job completion:** Set `videoExpiresAt = new Date(Date.now() + RETENTION_MS)` at job completion, not re-computed from the signed URL's expiry (which is a separate concern).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FFmpeg binary management | Custom binary downloader, PATH manipulation | `ffmpeg-static` | Pre-built statically linked binary for all platforms, includes Railway Linux |
| YouTube stream URL extraction | YouTube page scraping, URL guessing | `@distube/ytdl-core` | Handles signature decryption, format selection, anti-bot retries |
| Video stream piping | Manual Buffer chunking | `node:stream/promises` `pipeline()` | Correct backpressure, automatic cleanup, rejects on stream error |
| Temp file cleanup | Process-level signal handlers | `try/finally` with `fs.rm()` | Simpler; finally always runs even on thrown errors |
| Storage signed URLs | Own URL signing / token scheme | Supabase Storage `createSignedUrl()` | Built-in; time-limited; separate key from JWT rotation |
| Supabase Storage delete by path | Custom HTTP DELETE calls | `supabase.storage.from(bucket).remove([paths])` | Handles errors, supports batch deletes |

**Key insight:** FFmpeg, stream download, and object storage each have deep edge-case complexity (keyframe alignment, bandwidth throttling, multipart uploads). Using purpose-built packages avoids re-implementing these.

---

## Common Pitfalls

### Pitfall 1: @distube/ytdl-core Repository Archived

**What goes wrong:** YouTube updates its player signature obfuscation; the downloader returns errors or downloads wrong streams.
**Why it happens:** The repo was archived August 16, 2025. No upstream patches will be applied to fix YouTube-side changes.
**How to avoid:** Keep the package pinned to 4.16.12 (already on npm, won't disappear). Accept this risk for MVP. The CONTEXT.md upgrade path is `yt-dlp` if needed.
**Warning signs:** Download jobs suddenly fail with HTTP 403, 410, or corrupted streams; or `ytdl.validateURL()` starts returning false for valid URLs.

### Pitfall 2: ffmpeg-static ESM Default Import

**What goes wrong:** `import ffmpegPath from 'ffmpeg-static'` returns `null` or throws in some bundler configurations.
**Why it happens:** ffmpeg-static's package.json uses a conditional export; some ESM runtimes don't resolve the default correctly.
**How to avoid:** Use `import ffmpegPath from 'ffmpeg-static'` and add a guard: `if (!ffmpegPath) throw new Error('ffmpeg-static returned null — check installation')`.
**Warning signs:** `spawn(null, [...])` throws `ERR_INVALID_ARG_TYPE` at startup.

### Pitfall 3: -c copy Segment Start Drift

**What goes wrong:** Extracted segments start a few seconds before the requested `startMs` because FFmpeg seeks to the nearest preceding keyframe.
**Why it happens:** Stream copy cannot cut at non-keyframe boundaries; for 2s GOP videos, drift can be 0–2s per segment.
**How to avoid:** This is acceptable for the MVP — lecture clips are approximately timestamped anyway. Document the limitation. If it becomes a problem, switch to `-c:v libx264 -c:a aac` for frame-accurate cuts at the cost of encoding time.
**Warning signs:** Users report clips starting before the relevant content.

### Pitfall 4: Supabase Storage Bucket Not Pre-Created

**What goes wrong:** The worker's first `upload()` call fails with "Bucket not found" or similar.
**Why it happens:** `ffmpeg-static` does not auto-create buckets; they must exist before upload.
**How to avoid:** Create the `clip-videos` bucket in the Supabase dashboard as a private bucket before deploying Phase 4. Document this in VERIFICATION.md as a manual setup step.
**Warning signs:** First upload fails with a storage error referencing the bucket name.

### Pitfall 5: SUPABASE_SERVICE_ROLE_KEY Missing from Worker Environment

**What goes wrong:** Worker's Supabase admin client uses the anon key, which is subject to RLS; storage uploads fail with permission errors.
**Why it happens:** Worker currently only needs `DATABASE_URL`/`WORKER_DATABASE_URL`. The service role key is a new env var for Phase 4.
**How to avoid:** Add `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` to worker's `.env.local` and to Railway's environment variables. `SUPABASE_URL` may already be set (check existing worker env).
**Warning signs:** Storage upload returns a 403 or RLS-related error.

### Pitfall 6: Signed URL Expiry Mismatch

**What goes wrong:** Video plays when job is fresh but the signed URL expires before `videoExpiresAt`, or cleanup deletes the file but the URL still appears valid.
**Why it happens:** Two separate timers: (a) Supabase signed URL expiry, (b) `videoExpiresAt` cleanup window. If (a) < (b), the video breaks before cleanup runs. If (a) > (b), cleanup deletes the file but the URL is still signed.
**How to avoid:** Set `createSignedUrl(path, RETENTION_S)` and `videoExpiresAt = Date.now() + RETENTION_MS` using the same value (24h). The URL becomes non-playable either when (a) it expires or (b) the storage file is deleted — both happen at ~24h. Minor drift is acceptable.
**Warning signs:** Player shows error before `videoExpiresAt` or after file is deleted.

### Pitfall 7: Large Source Video OOM

**What goes wrong:** Worker crashes with OOM when downloading a 2-hour lecture (1–3 GB) before FFmpeg processes it.
**Why it happens:** `readFile` loads the entire file into a Node.js Buffer before passing to FFmpeg or upload. Railway free tier has limited RAM.
**How to avoid:** Download to a temp file on disk via `pipeline(ytdlStream, fs.createWriteStream(destPath))`. Pass the file path string to FFmpeg. For the upload step, use `createReadStream(filePath)` if Supabase Storage supports streams (or `readFile` only for the stitched output, which is shorter than the source).
**Warning signs:** Worker process killed by OOM; Railway logs show exit code 137.

---

## Code Examples

### FFmpeg Extraction Command (Direct spawn)

```typescript
// Source: FFmpeg CLI docs + Node.js child_process [ASSUMED]
// Extract segment from sourceFile: startMs=65000, endMs=125000
spawn(ffmpegPath, [
  '-ss', '65.000',      // seek before -i: fast
  '-to', '125.000',     // end time in seconds
  '-i', '/tmp/clip-that-jobId/source.mp4',
  '-c', 'copy',         // no re-encode
  '-avoid_negative_ts', 'make_zero',
  '-y',
  '/tmp/clip-that-jobId/segment-0.mp4',
])
```

### FFmpeg Concat Demuxer Command

```typescript
// Source: FFmpeg concat demuxer docs [ASSUMED]
// filelist.txt content:
//   file '/tmp/clip-that-jobId/segment-0.mp4'
//   file '/tmp/clip-that-jobId/segment-1.mp4'
spawn(ffmpegPath, [
  '-f', 'concat',
  '-safe', '0',
  '-i', '/tmp/clip-that-jobId/filelist.txt',
  '-c', 'copy',
  '-y',
  '/tmp/clip-that-jobId/output.mp4',
])
```

### Supabase Storage Remove (batch cleanup)

```typescript
// Source: Supabase docs [ASSUMED]
const { error } = await supabaseAdmin.storage
  .from('clip-videos')
  .remove(['jobs/uuid-1/output.mp4', 'jobs/uuid-2/output.mp4'])
```

### HTML5 Video Tab (status-view.tsx)

```tsx
// Source: D-08, CONTEXT.md [CITED: .planning/phases/04-stitched-video-output/04-CONTEXT.md]
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

### Prisma Schema Additions

```prisma
// Source: CONTEXT.md D-05 [CITED: .planning/phases/04-stitched-video-output/04-CONTEXT.md]
model Job {
  // ... existing fields ...
  stitchedTranscript Json?      // Phase 3
  videoUrl           String?    // Phase 4: Supabase Storage signed URL
  videoExpiresAt     DateTime?  // Phase 4: expiry for cleanup pass
  // ...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ytdl-core (fent) | @distube/ytdl-core (active fork, now archived) | 2023/2025 | Fork was the standard; now archived; future is youtubei.js |
| fluent-ffmpeg wrapper | Direct child_process.spawn | 2024 | fluent-ffmpeg deprecated on npm; direct spawn is cleaner |
| Supabase Storage public buckets | Private buckets + signed URLs | Current | Better security; URLs expire; required for VID-04 |
| setInterval for cleanup | Worker polling loop reuse | Phase 4 design | No extra infrastructure; same polling tick handles cleanup |

**Deprecated/outdated:**
- `fluent-ffmpeg`: Officially deprecated on npm (2024). Do not use; use direct `child_process.spawn`.
- `ytdl-core` (fent's original): Abandoned 2023. `@distube/ytdl-core` was the fork but is also now archived.
- `@ffmpeg-installer/ffmpeg`: Not deprecated, but `ffmpeg-static` is simpler (returns path directly, no `.path` property needed).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pipeline()` from `node:stream/promises` works correctly with ytdl-core stream | Pattern 1 | May need to use `.pipe()` + manual promise wrapping; low risk |
| A2 | Supabase `createSignedUrl` `expiresIn` parameter is in seconds (not milliseconds) | Pattern 4 | URLs expire 1000x too quickly or too slowly; test immediately |
| A3 | Concat demuxer works without re-encoding for YouTube mp4 segments | Pattern 3 | If codec mismatch, concat filter needed (much slower) |
| A4 | Railway's container `/tmp` (or `os.tmpdir()`) has enough disk space for source video + segments | Pitfall 7 | OOM or disk-full error on large videos; may need streaming extraction |
| A5 | `ffmpeg-static` ESM default import resolves correctly in worker's ESM context | Pattern 2 | May need `createRequire` or different import style |
| A6 | Supabase Storage `remove()` accepts an array of paths and deletes them | Pattern 6 | May need to iterate and call remove individually |
| A7 | `@distube/ytdl-core` still successfully downloads YouTube videos at the time of Phase 4 implementation | Standard Stack | Archival means YouTube anti-bot changes may break it; D-02 fallback is yt-dlp |
| A8 | HTML5 `<video>` can play Supabase-hosted mp4 via signed URL without CORS issues | Code Examples | If CORS headers not set on Supabase bucket, video tag may refuse to play |

---

## Open Questions

1. **CORS on Supabase Storage bucket**
   - What we know: Browsers enforce CORS on video src attributes for cross-origin playback.
   - What's unclear: Whether Supabase Storage's default CORS config allows the Next.js app origin.
   - Recommendation: In VERIFICATION.md, add a manual test that the `<video>` actually plays from a signed URL; configure CORS in Supabase Storage settings if needed (`allowed_origins: [app domain]`).

2. **Railway disk space for temp files**
   - What we know: Railway free tier containers have limited disk (`/tmp` is typically ephemeral with a few GB).
   - What's unclear: Exact disk limit on Railway free tier; whether a 1-hour 720p YouTube video (~500MB) fits.
   - Recommendation: Add a size check in `downloadYouTubeVideo()` or rely on Railway's OOM kill as a natural throttle; document in VERIFICATION.md.

3. **ytdl-core format availability for arbitrary YouTube videos**
   - What we know: Most YouTube videos have a combined `videoandaudio` mp4 format below 720p. 1080p+ separates audio and video streams (requires merging).
   - What's unclear: Whether the filter `container === 'mp4' && hasVideo && hasAudio` always finds a format, or whether some videos (e.g., 4K-only) require separate streams + FFmpeg merge.
   - Recommendation: Add a fallback: if no combined mp4 format, fall back to `quality: 'lowest'` combined format. Log a warning for 1080p-only videos. For MVP, 720p combined is acceptable.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Worker runtime | Yes | v22.19.0 | — |
| npm | Package install | Yes | 11.16.0 | — |
| ffmpeg (system) | FFmpeg binary | No | — | ffmpeg-static npm package (installs binary) |
| @supabase/supabase-js | Storage upload | Yes (in app) | ^2.108.1 | — |
| Supabase Storage bucket | File storage | Not yet | — | Must be created in dashboard (manual step) |
| SUPABASE_SERVICE_ROLE_KEY | Worker auth bypass | Unknown | — | Must add to .env.local + Railway env vars |
| SUPABASE_URL | Worker Supabase client | Unknown | — | Already in app env; check worker env |
| Railway /tmp disk | Temp file storage | Assumed | ~1-2 GB | — |

**Missing dependencies with no fallback:**
- Supabase Storage bucket `clip-videos` — must be manually created in Supabase dashboard before first deploy.
- `SUPABASE_SERVICE_ROLE_KEY` in worker environment — required for storage upload; not currently in worker's `.env.local`.

**Missing dependencies with fallback:**
- System FFmpeg — resolved by `ffmpeg-static` npm package (installed as part of Phase 4).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `worker/vitest.config.ts` |
| Quick run command | `cd worker && npm run test:run` |
| Full suite command | `cd worker && npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VID-01 | Worker extracts segments via FFmpeg from source video | unit | `cd worker && npm run test:run -- --reporter=verbose` | No — Wave 0 |
| VID-02 | Concat demuxer stitches segments into output.mp4 | unit | same | No — Wave 0 |
| VID-03 | Browser `<video>` renders when `videoUrl` is set | unit (React Testing Library) | `npm run test:run` (from root) | No — Wave 0 |
| VID-04 | Cleanup pass nulls videoUrl + deletes storage file | unit | `cd worker && npm run test:run -- --reporter=verbose` | No — Wave 0 |
| JOB-03 | `cleanupExpiredVideos()` only processes past-expiry rows | unit | same | No — Wave 0 |

**Test approach for worker modules:** All I/O is mockable. Unit tests for `videoDownloader.ts`, `videoExtractor.ts`, `videoStitcher.ts`, `storageUploader.ts`, and `videoCleanup.ts` use `vi.mock` to stub `child_process.spawn`, `@distube/ytdl-core`, and the Supabase client — same pattern as Phase 3's `stitchedTranscript.test.ts`.

**Test approach for status-view.tsx Video tab:** Use `@testing-library/react` (already in devDependencies). Pass `videoUrl` as a prop or mock the Supabase Realtime payload; assert `<video>` element is rendered with correct `src`.

### Sampling Rate

- **Per task commit:** `cd worker && npm run test:run`
- **Per wave merge:** `cd worker && npm run test:run && npm test` (from root)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `worker/src/__tests__/videoDownloader.test.ts` — covers VID-01 download step
- [ ] `worker/src/__tests__/videoExtractor.test.ts` — covers VID-01 FFmpeg extraction step
- [ ] `worker/src/__tests__/videoStitcher.test.ts` — covers VID-02 concat demuxer step
- [ ] `worker/src/__tests__/storageUploader.test.ts` — covers VID-03 URL generation
- [ ] `worker/src/__tests__/videoCleanup.test.ts` — covers VID-04 + JOB-03 cleanup logic
- [ ] `src/__tests__/status-view-video-tab.test.tsx` — covers VID-03 `<video>` rendering

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 4 uses existing session (Phase 1) |
| V3 Session Management | No | Existing session passed through |
| V4 Access Control | Yes | Supabase RLS already enforces userId isolation on Job row; storage paths scoped by jobId (UUID) |
| V5 Input Validation | Yes | `youtubeUrl` already validated by `extractYouTubeVideoId()` before Phase 4 pipeline starts |
| V6 Cryptography | No | Signed URLs generated by Supabase; no custom crypto |
| V7 Error Handling | Yes | FFmpeg errors must map to user-facing message via `mapTranscriptError()` pattern; no stack traces to client |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service role key leaked to client | Information Disclosure | Never include SUPABASE_SERVICE_ROLE_KEY in Next.js env (no `NEXT_PUBLIC_` prefix); worker-only |
| Path traversal in storage path | Tampering | Use `jobs/${jobId}/output.mp4` where jobId is a Prisma-generated UUID; no user input in path |
| Arbitrary URL download | Spoofing | `youtubeUrl` is validated by `extractYouTubeVideoId()` before reaching downloader; only YouTube IDs passed to ytdl |
| Signed URL oversharing | Information Disclosure | Signed URL is stored on Job row; Job row is RLS-protected (userId filter); only the owning user's Realtime channel receives it |
| CORS misconfiguration on video playback | Information Disclosure | Set Supabase Storage CORS to allow only the app's origin; verify in VERIFICATION.md |

---

## Sources

### Primary (HIGH confidence)
- None — no Context7 queries returned results for these packages in this session.

### Secondary (MEDIUM confidence)
- [github.com/eugeneware/ffmpeg-static README](https://github.com/eugeneware/ffmpeg-static/blob/master/packages/ffmpeg-static/README.md) — binary path usage
- [github.com/distubejs/ytdl-core](https://github.com/distubejs/ytdl-core) — archival notice, ESM import, stream API
- [supabase.com/docs/guides/storage/serving/downloads](https://supabase.com/docs/guides/storage/serving/downloads) — createSignedUrl method, expiry in seconds
- [nesin.io/blog/upload-file-supabase-storage-node](https://nesin.io/blog/upload-file-supabase-storage-node) — createClient with service role, upload pattern
- [renderio.dev/blogs/ffmpeg-concat-guide/](https://renderio.dev/blogs/ffmpeg-concat-guide/) — concat demuxer filelist format
- [mux.com/articles/clip-sections-of-a-video-with-ffmpeg](https://www.mux.com/articles/clip-sections-of-a-video-with-ffmpeg) — -c copy vs re-encode tradeoff

### Tertiary (LOW confidence — marked [ASSUMED])
- npm registry version checks for all packages (confirmed registry existence; not authoritatively verified via Context7)
- Code examples in Pattern sections (based on documented APIs; must be tested during implementation)

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — all packages verified on npm registry; versions confirmed; archival status verified from GitHub
- Architecture: MEDIUM — pipeline design follows established worker patterns from Phases 2–3
- Pitfalls: MEDIUM — FFmpeg/ytdl-core edge cases well-documented online; Supabase behavior inferred from docs
- Code examples: LOW — not run against actual installed packages; treat as reference patterns

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (30 days) — YouTube downloader reliability may degrade faster given @distube/ytdl-core archival
