import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// family: 4 forces IPv4 — Windows resolves Supabase hostnames to IPv6 first,
// but the pooler only accepts IPv4, causing ECONNREFUSED without this flag.
const pool = new pg.Pool({
  connectionString: process.env.WORKER_DATABASE_URL ?? process.env.DATABASE_URL,
  family: 4,
})

const adapter = new PrismaPg(pool)
export const prisma = new PrismaClient({ adapter })
