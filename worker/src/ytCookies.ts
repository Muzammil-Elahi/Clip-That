import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let cookiesPath: string | null = null

// Lazily writes YOUTUBE_COOKIES env var to a temp file on first call.
// yt-dlp reads cookies in Netscape format; the env var should contain that content verbatim.
export function getCookiesPath(): string | null {
  if (!process.env.YOUTUBE_COOKIES) return null
  if (cookiesPath) return cookiesPath
  cookiesPath = join(tmpdir(), 'yt-cookies.txt')
  writeFileSync(cookiesPath, process.env.YOUTUBE_COOKIES, 'utf-8')
  return cookiesPath
}
