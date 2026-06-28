'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { submitJobSchema } from '@/lib/schemas'

type SubmitJobResult =
  | { errors: ReturnType<typeof submitJobSchema.safeParse>['error'] extends infer E ? E extends z.ZodError ? ReturnType<z.ZodError['flatten']> : never : never }
  | { error: string }
  | { jobId: string }

/**
 * Server Action: validates form data, ensures an anonymous session exists,
 * then creates a PENDING Job row in Supabase via Prisma.
 *
 * Security (T-01-01, T-01-02):
 * - Always calls getUser() (network-validated), never getSession() (cookie-trusted).
 * - Zod safeParse runs before any DB operation.
 *
 * Privacy (T-01-03):
 * - Returns { jobId } held in React state only — never written to URL or storage.
 */
export async function submitJob(
  _prevState: unknown,
  formData: FormData
): Promise<SubmitJobResult> {
  // 1. Validate inputs with Zod (T-01-02)
  const result = submitJobSchema.safeParse({
    youtubeUrl: formData.get('youtubeUrl'),
    topic: formData.get('topic'),
    semanticEnabled: formData.get('semanticEnabled'),
  })

  if (!result.success) {
    return { errors: result.error.flatten() }
  }

  // 2. Validate session server-side (T-01-01 — always getUser, never getSession)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No session — please refresh and try again.' }
  }

  // 3. Create the job row (RLS enforces userId = auth.uid() — T-01-04)
  const { youtubeUrl, topic, semanticEnabled } = result.data
  try {
    const job = await prisma.job.create({
      data: {
        userId: user.id,
        youtubeUrl,
        topic,
        status: 'PENDING',
        semanticEnabled,
      },
    })
    return { jobId: job.id }
  } catch {
    return { error: 'Failed to create job — please try again.' }
  }
}
