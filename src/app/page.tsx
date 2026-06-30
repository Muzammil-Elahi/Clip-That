export const dynamic = 'force-dynamic'

import SubmissionForm from '@/components/submission-form'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <SubmissionForm />
    </main>
  )
}
