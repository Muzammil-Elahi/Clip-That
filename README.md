# Clip That

Paste a YouTube URL and a topic. Clip That finds every moment in the video where that topic is discussed, cuts everything else, and gives you a stitched clip, a timestamped transcript, and AI-generated study notes.

---

## What you get

After processing, the status page shows three tabs:

- **Video** — a single MP4 of just the relevant segments, playable in-browser
- **Transcript** — the spoken text from those segments with source timestamps
- **Notes** — AI-generated study notes in Markdown, downloadable as a PDF

There is also an optional **"Also find related references"** checkbox. When checked, the worker uses Google Gemini embeddings to find segments that are semantically related to the topic, not just exact keyword matches.

---

## How it works

The app is split into two processes that run separately.

### Next.js app (the frontend)

- User submits a YouTube URL and topic via a form
- A [Server Action](src/actions/submit-job.ts) validates the input, creates an anonymous Supabase session, and inserts a `Job` row into PostgreSQL with status `PENDING`
- The browser navigates to `/status` and subscribes to a Supabase Realtime channel scoped to that job
- When the worker marks the job `DONE`, the Realtime update fires and the UI renders the results without a page reload

### Worker (the backend processor)

The worker ([worker/src/index.ts](worker/src/index.ts)) is a long-running Node.js process that polls the database every few seconds for `PENDING` jobs and runs this pipeline for each one:

| Step | What happens |
|------|-------------|
| 1. Transcript fetch | Downloads the auto-generated YouTube captions via `youtube-transcript-plus` |
| 2. Keyword matching | Scans each transcript segment for mentions of the topic |
| 3. Semantic matching *(optional)* | Embeds the topic and all segments with `gemini-embedding-001`, returns segments above a cosine similarity threshold |
| 4. Context expansion | Expands each matched window by a few segments in each direction so clips don't start mid-sentence |
| 5. Study notes | Passes the stitched transcript to Gemini and asks it to produce student-focused Markdown notes |
| 6. Video download | Downloads the full video with `yt-dlp` |
| 7. Segment extraction | Uses FFmpeg to cut the matched time ranges from the source file |
| 8. Stitching | Concatenates the segments into a single output MP4 |
| 9. Upload | Uploads the stitched video to Supabase Storage and stores a 24-hour signed URL |
| 10. Done | Updates the job row to `DONE` — the Realtime event fires on the frontend |

### Data model

One table: `Job`. Key columns: `youtubeUrl`, `topic`, `status`, `transcript` (JSON), `clipPlan` (JSON), `stitchedTranscript` (JSON), `videoUrl`, `studyNotes`, `semanticEnabled`, `semanticFailed`.

---

## Tech stack

| Layer | Tools |
|-------|-------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | Supabase (PostgreSQL), Prisma v7 |
| Auth | Supabase anonymous auth |
| Realtime | Supabase Realtime (WebSocket) |
| Storage | Supabase Storage |
| AI | Google Gemini (`gemini-embedding-001` for embeddings, `gemini-3.0-flash` for study notes) |
| Video | `yt-dlp` (download), `ffmpeg-static` (cut + stitch) |

---

## Running locally

### Prerequisites

- **Node.js 20+**
- **yt-dlp** on your PATH — install via `pip install yt-dlp` or `brew install yt-dlp`
- A **Supabase project** (free tier works)
- A **Google Gemini API key** (for semantic search and study notes)

### 1. Clone and install

```bash
git clone https://github.com/your-username/clip-that.git
cd clip-that

# Install frontend dependencies
npm install

# Install worker dependencies
cd worker && npm install && cd ..
```

### 2. Configure environment variables

Create **two** env files:

**`.env.local`** (root — used by Next.js and Prisma):

```env
# Supabase project settings (Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Database connections (Settings → Database → Connection string)
DATABASE_URL=postgresql://postgres.your-project:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.your-project:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

**`worker/.env.local`** (worker — never shared with the browser):

```env
# Direct Postgres connection for the worker (same as DIRECT_URL above)
WORKER_DATABASE_URL=postgresql://postgres.your-project:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres

# Supabase admin credentials for uploading videos (Settings → API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Gemini — https://aistudio.google.com/apikey
GEMINI_API_KEY=your-gemini-api-key
```

### 3. Set up Supabase

In your Supabase project dashboard:

1. **Authentication → Providers** — enable **Anonymous**
2. **Storage** — create a bucket named `clip-videos` (can be private; the worker uses the service role key to upload)

### 4. Run database migrations

```bash
npx prisma migrate deploy
```

### 5. Start the app and worker

Open two terminals:

```bash
# Terminal 1 — Next.js frontend (http://localhost:3000)
npm run dev
```

```bash
# Terminal 2 — background worker
cd worker && npm start
```

Go to [http://localhost:3000](http://localhost:3000), paste a YouTube URL, enter a topic, and submit. The worker picks it up within a few seconds and you can watch the status page update live.

---

## Project structure

```
clip-that/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home — submission form
│   │   └── status/page.tsx       # Status — live job tracker
│   ├── components/
│   │   ├── submission-form.tsx   # URL + topic form
│   │   ├── status-view.tsx       # Realtime status + results tabs
│   │   └── StudyNotesPDFDocument.tsx
│   ├── actions/
│   │   └── submit-job.ts         # Server Action — creates the Job row
│   └── lib/
│       ├── prisma.ts
│       └── supabase/
├── worker/
│   └── src/
│       ├── index.ts              # Main poll loop
│       ├── transcript.ts         # YouTube caption fetcher
│       ├── matcher.ts            # Keyword matching
│       ├── semanticMatcher.ts    # Gemini embedding search
│       ├── contextExpander.ts    # Window expansion + merge
│       ├── notesGenerator.ts     # Gemini study notes
│       ├── videoDownloader.ts    # yt-dlp wrapper
│       ├── videoExtractor.ts     # FFmpeg segment cutter
│       ├── videoStitcher.ts      # FFmpeg concat
│       └── storageUploader.ts    # Supabase Storage upload
└── prisma/
    └── schema.prisma
```
