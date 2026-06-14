import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// Load .env.local for Next.js projects (Prisma does not read .env.local by default)
config({ path: '.env.local' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: env('DIRECT_URL'),
  },
})
