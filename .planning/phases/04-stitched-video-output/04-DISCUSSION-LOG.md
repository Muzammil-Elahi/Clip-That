# Phase 4: Stitched Video Output - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 04-stitched-video-output
**Areas discussed:** Gray area selection, YouTube download strategy, Artifact storage, Artifact expiration, Video tab UI, Cost constraint

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| YouTube download strategy | How the worker fetches the YouTube video for FFmpeg processing | ✓ |
| Artifact storage backend | Where the stitched .mp4 lives and how it's served | ✓ |
| Artifact expiration mechanism | How temporary video files get cleaned up | ✓ |
| Video tab UI | What the Video tab shows when DONE | ✓ |

**User's choice:** "What do you recommend" — deferred all four to Claude's recommendations  
**Notes:** User asked for Claude's recommendation on all areas rather than selecting options. Recommendations were presented and then confirmed.

---

## YouTube Download Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| `@distube/ytdl-core` | Active Node.js fork, no Railway binary setup needed | ✓ |
| `yt-dlp` binary | More reliable but requires Railway system package configuration | |
| Other Node approach | yt-dlp-exec or similar wrapper | |

**User's choice:** Locked Claude's recommendation — `@distube/ytdl-core`  
**Notes:** Node-only package, same install pattern as `youtube-transcript-plus`. yt-dlp remains the upgrade path if anti-bot measures degrade reliability.

---

## Artifact Storage Backend

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Storage | Already in stack, free tier 1GB/2GB, signed URLs | ✓ |
| Railway ephemeral filesystem | Simplest, but lost on restart/redeploy | |
| Cloudflare R2 / AWS S3 | Zero egress / established, but requires new account/setup | |

**User's choice:** Locked Claude's recommendation — Supabase Storage  
**Notes:** Already in the stack, no new services needed. Free tier sufficient for MVP.

---

## Artifact Expiration Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Worker cleanup pass + `videoExpiresAt` | Extend existing polling loop; delete expired files per tick | ✓ |
| Signed URL expiry only | URL expires but file persists (wastes storage) | |
| Supabase Storage lifecycle policy | Not available in Supabase Storage | |
| Delete on first access | Risky — user can't watch twice | |

**User's choice:** Locked Claude's recommendation — worker cleanup pass with `videoExpiresAt`  
**Notes:** Natural extension of the existing 4-second polling loop. No new infrastructure.

---

## Video Tab UI

| Option | Description | Selected |
|--------|-------------|----------|
| HTML5 `<video>` native controls | Zero dependencies, works everywhere | ✓ |
| Custom player UI | More effort, no benefit for MVP | |

**User's choice:** Locked Claude's recommendation — HTML5 `<video>` with native controls  
**Notes:** `videoUrl` flows via Supabase Realtime same as `stitchedTranscript`. Video tab shows player when `videoUrl` is present.

---

## Cost Constraint

**User clarification (free-text):** "we are only using free services or free tier plans"  
**Decision locked:** All services and packages used in Phase 4 must be free or on a free tier. No paid infrastructure. This applies to storage (Supabase Storage free tier), packages (npm packages, FFmpeg static binary), and Railway (existing worker).

---

## Claude's Discretion

- FFmpeg wrapper choice (fluent-ffmpeg vs direct child_process)
- FFmpeg binary package (ffmpeg-static, @ffmpeg-installer/ffmpeg, or similar)
- Supabase Storage bucket name and file path convention
- Retention window constant value (24h recommended)
- Worker cleanup query batching/limit per tick
- FFmpeg concat approach (filter_complex vs demuxer)
- Prisma field names

## Deferred Ideas

None — discussion stayed within phase scope.
