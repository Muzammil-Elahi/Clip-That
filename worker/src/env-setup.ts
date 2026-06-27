import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load worker/.env.local first (worker-specific vars)
config({ path: resolve(__dirname, '../.env.local') })
// Then root .env.local as fallback (shared vars like DATABASE_URL)
config({ path: resolve(__dirname, '../../.env.local') })
