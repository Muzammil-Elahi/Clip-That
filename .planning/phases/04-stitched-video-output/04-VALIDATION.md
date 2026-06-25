---
phase: 04
slug: stitched-video-output
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | `worker/vitest.config.ts` (worker unit tests); `vitest.config.ts` (root — frontend tests) |
| **Quick run command** | `cd worker && npm run test:run` |
| **Full suite command** | `cd worker && npm run test:run && npm test` (from project root) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npm run test:run`
- **After every plan wave:** Run `cd worker && npm run test:run && npm test` (from project root)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 1 | VID-01, VID-02, VID-04, JOB-03 | T-04-01, T-04-02 | No user input in storage path; service role key never in browser env | unit (RED scaffold) | `cd worker && npm run test:run` | ❌ W0 | ⬜ pending |
| 04-01-T2 | 04-01 | 1 | VID-01, VID-02, VID-04, JOB-03 | T-04-01, T-04-02 | Path scoped by UUID; SUPABASE_SERVICE_ROLE_KEY worker-only | unit (GREEN impl) | `cd worker && npm run test:run` | ❌ W0 | ⬜ pending |
| 04-02-T1 | 04-02 | 2 | VID-03 | T-04-03 | videoUrl not rendered if null; no dangerouslySetInnerHTML | unit/RTL (RED scaffold) | `npm test` (from root) | ❌ W0 | ⬜ pending |
| 04-02-T2 | 04-02 | 2 | VID-03 | T-04-03 | `<video src>` accepts only pre-signed Supabase URL string from state | unit/RTL (GREEN impl) | `npm test` (from root) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `worker/src/__tests__/videoDownloader.test.ts` — RED stubs covering VID-01 download step (mock `@distube/ytdl-core` stream)
- [ ] `worker/src/__tests__/videoExtractor.test.ts` — RED stubs covering VID-01 FFmpeg extraction step (mock `child_process.spawn`)
- [ ] `worker/src/__tests__/videoStitcher.test.ts` — RED stubs covering VID-02 concat demuxer step (mock `child_process.spawn`)
- [ ] `worker/src/__tests__/storageUploader.test.ts` — RED stubs covering VID-03 signed URL generation (mock Supabase client)
- [ ] `worker/src/__tests__/videoCleanup.test.ts` — RED stubs covering VID-04 + JOB-03 cleanup logic (mock Prisma + Supabase)
- [ ] `src/__tests__/status-view-video-tab.test.tsx` — RED stubs covering VID-03 `<video>` rendering (React Testing Library)

All six files are new — no existing infrastructure to extend for these modules.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase Storage bucket `clip-videos` exists as private | VID-04 | Bucket creation requires Supabase dashboard UI | Log into Supabase dashboard → Storage → New bucket → name: `clip-videos`, public: off |
| `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` set in worker env | VID-01, VID-02 | Env vars require Railway dashboard or `.env.local` manual edit | Check `worker/.env.local`; add `SUPABASE_SERVICE_ROLE_KEY=<service_role_key>` and `SUPABASE_URL=<project_url>` from Supabase dashboard → Settings → API |
| `<video>` element plays from Supabase signed URL in browser | VID-03 | CORS config on Supabase Storage bucket may require manual setup | Submit a test job; when DONE, open Video tab; if video fails to load, configure CORS in Supabase Storage settings to allow the app origin |
| Artifact expiry: video URL becomes non-playable after ~24h | VID-04, JOB-03 | Requires waiting or manual clock manipulation | Set `RETENTION_MS` to a short interval (e.g., 60000 ms = 1 min) locally; verify cleanup pass nulls `videoUrl` and deletes from storage; then restore to 24h |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
