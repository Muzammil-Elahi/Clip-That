import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Worker Prisma client using service-role database URL.
 * Uses WORKER_DATABASE_URL (postgres role) to bypass RLS when writing job status and transcript data.
 * No globalForPrisma singleton — worker is a long-running process, not a serverless function.
 */

const adapter = new PrismaPg({
  connectionString: process.env.WORKER_DATABASE_URL!, // service role URL — bypasses RLS
})

export const prisma = new PrismaClient({ adapter })
