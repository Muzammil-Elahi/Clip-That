import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localBin = join(__dirname, '..', 'bin', 'yt-dlp')

// On Linux/Mac: prefer the locally downloaded binary (worker/bin/yt-dlp).
// Falls back to system PATH if it's not there (e.g. local dev with yt-dlp installed globally).
// On Windows: always use the system yt-dlp.exe (dev machines only).
export const YTDLP_BIN = process.platform === 'win32'
  ? 'yt-dlp.exe'
  : (existsSync(localBin) ? localBin : 'yt-dlp')
