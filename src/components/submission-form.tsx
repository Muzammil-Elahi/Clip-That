'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { submitJob } from '@/actions/submit-job'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import LoadingOverlay from '@/components/loading-overlay'

/**
 * FormContent — nested inside the <form> so useFormStatus() can access the
 * enclosing form's pending state.
 *
 * Receives state from the parent to display field-level errors, and uses
 * useFormStatus to disable the submit button and show the loading overlay.
 */
function FormContent({
  state,
}: {
  state: Awaited<ReturnType<typeof submitJob>> | null
}) {
  const { pending: isPending } = useFormStatus()

  // Extract field errors from the flattened Zod error shape.
  // fieldErrors is Record<string, string[] | undefined> at runtime; cast to access by key.
  type FieldErrors = Record<string, string[] | undefined>
  const fieldErrors =
    state && 'errors' in state
      ? (state.errors?.fieldErrors as FieldErrors | undefined)
      : undefined

  const urlErrors: string[] = fieldErrors?.['youtubeUrl'] ?? []
  const topicErrors: string[] = fieldErrors?.['topic'] ?? []
  const sessionError = state && 'error' in state ? state.error : null

  return (
    <>
      {/* Loading overlay positioned over the Card — rendered from the parent
          relative container, but driven by isPending from inside the form */}
      <LoadingOverlay show={isPending} />

      <div className="flex flex-col gap-6">
        {/* Heading */}
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Clip That
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Paste a YouTube video and a topic. Get only the parts that matter.
          </p>
        </div>

        {/* Session-level error (no user session) */}
        {sessionError && (
          <div aria-live="polite">
            <p className="text-sm text-destructive">{sessionError}</p>
          </div>
        )}

        {/* YouTube URL field */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="youtubeUrl">YouTube video URL</Label>
          <Input
            id="youtubeUrl"
            name="youtubeUrl"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            aria-describedby={
              urlErrors.length > 0 ? 'youtubeUrl-error' : undefined
            }
            aria-invalid={urlErrors.length > 0 ? true : undefined}
            disabled={isPending}
          />
          {urlErrors.length > 0 && (
            <p
              id="youtubeUrl-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {urlErrors[0]}
            </p>
          )}
        </div>

        {/* Topic field */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="topic">Topic or phrase</Label>
          <Input
            id="topic"
            name="topic"
            type="text"
            placeholder="e.g. gradient descent, photosynthesis, supply and demand"
            aria-describedby={
              topicErrors.length > 0 ? 'topic-error' : undefined
            }
            aria-invalid={topicErrors.length > 0 ? true : undefined}
            disabled={isPending}
          />
          {topicErrors.length > 0 && (
            <p
              id="topic-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {topicErrors[0]}
            </p>
          )}
        </div>

        {/* Submit button */}
        <Button type="submit" disabled={isPending} className="w-full h-11">
          Clip It
        </Button>
      </div>
    </>
  )
}

/**
 * SubmissionForm — client component for the YouTube URL + topic submission flow.
 *
 * Architecture:
 * - useActionState wraps submitJob to track server-returned validation errors
 * - useEffect watches for { jobId } success response and routes to /status
 *   WITHOUT the job ID in the URL (D-07, T-02-01)
 * - FormContent is a nested component so useFormStatus() can read isPending
 *   from the enclosing <form> element
 *
 * Security (T-02-01): router.push('/status') — no query params, no hash, no jobId.
 * Security (T-02-02): Error messages rendered as JSX text nodes, never innerHTML.
 */
export default function SubmissionForm() {
  const router = useRouter()
  const [state, formAction] = useActionState(submitJob, null)

  // Route to /status on successful job creation.
  // Job ID stays in React in-memory state only — never written to URL (D-07).
  useEffect(() => {
    if (state && 'jobId' in state && state.jobId) {
      router.push('/status')
    }
  }, [state, router])

  return (
    <div className="relative w-full max-w-md">
      <Card>
        <CardContent className="p-6">
          <form action={formAction}>
            <FormContent state={state} />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
