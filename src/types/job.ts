/**
 * Client-side JobStatus enum — mirrors the Prisma JobStatus enum for use in
 * browser components and Server Actions without importing from generated Prisma client.
 */
export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

/**
 * Client-side Job type — mirrors the Prisma Job model shape for use in
 * components and Server Actions. Timestamps serialised as ISO strings.
 */
export interface Job {
  id: string
  userId: string
  youtubeUrl: string
  topic: string
  status: JobStatus
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}
