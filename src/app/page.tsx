/**
 * Home page — server component shell that renders the SubmissionForm.
 *
 * force-dynamic prevents Next.js from statically caching the page.
 * Without this, concurrent anonymous users can share the same session
 * (RESEARCH.md Pitfall 1 — session caching in static rendering).
 */
export const dynamic = 'force-dynamic'

import SubmissionForm from '@/components/submission-form'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <SubmissionForm />
    </main>
  )
}
