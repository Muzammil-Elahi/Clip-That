/**
 * Status page — server component shell.
 *
 * Validates the anonymous user session via getUser() (T-03-02: network-validated,
 * never trusts cookie-only getSession()), then looks up the most recent job for that
 * user (DONE, FAILED, or in-progress) so the result is shown after processing completes.
 * Redirects to / if no job is found or if no valid user session exists.
 *
 * Security (T-03-04): Job lookup is scoped by userId — no IDOR risk.
 * Security (T-03-02): Uses getUser() not getSession() (RESEARCH Pitfall 6).
 * Security (T-03-05): Query scoped by userId=user.id — IDOR prevention; RLS enforced on Job table.
 */
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import StatusView from '@/components/status-view'
import { parseStitchedTranscript } from '@/lib/parseStitchedTranscript'

export default async function StatusPage() {
  // Validate session using network-validated getUser() (T-03-02)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Look up the most recent job for this user (DONE, FAILED, or in-progress) so the result
  // is shown after processing completes (fixes DONE-job display bug — RESEARCH.md Pitfall 1).
  // Security (T-03-05): scoped by userId — no IDOR risk.
  const job = await prisma.job.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  // Empty state — no job found for this user
  if (!job) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="text-center flex flex-col gap-4">
          <p className="text-base text-muted-foreground">
            No active job. Ready to clip something?
          </p>
          <a href="/" className="text-base font-semibold underline underline-offset-4 hover:text-muted-foreground transition-colors">
            Start over
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <StatusView
        userId={user.id}
        initialStatus={job.status}
        initialJobId={job.id}
        initialErrorMessage={job.errorMessage ?? null}
        initialStitchedTranscript={parseStitchedTranscript(job.stitchedTranscript)}
        initialVideoUrl={job.videoUrl ?? null}
        topic={job.topic}
        initialStudyNotes={job.studyNotes ?? null}
        youtubeUrl={job.youtubeUrl}
        semanticEnabled={job.semanticEnabled}
        initialSemanticFailed={job.semanticFailed}
      />
    </main>
  )
}
