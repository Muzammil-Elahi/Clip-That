import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Prisma 7 client singleton with PrismaPg driver adapter.
 * Uses the pooled DATABASE_URL for runtime queries (Supabase Supavisor).
 * Global singleton pattern prevents connection exhaustion in serverless/hot-reload.
 */

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
