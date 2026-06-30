import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// On Windows yt-dlp.exe is expected to be on PATH already (dev machine)
if (process.platform === 'win32') process.exit(0)

const __dirname = dirname(fileURLToPath(import.meta.url))
const binDir = join(__dirname, '..', 'bin')
const dest = join(binDir, 'yt-dlp')

if (existsSync(dest)) {
  console.log('yt-dlp already present at', dest)
  process.exit(0)
}

mkdirSync(binDir, { recursive: true })
console.log('Downloading yt-dlp...')
execSync(
  `curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${dest}"`,
  { stdio: 'inherit' },
)
execSync(`chmod +x "${dest}"`)
console.log('yt-dlp installed to', dest)
