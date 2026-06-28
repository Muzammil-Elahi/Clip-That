'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { submitJob } from '@/actions/submit-job'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import LoadingOverlay from '@/components/loading-overlay'

/**
 * FormContent — nested inside the <form> so useFormStatus() can access the
 * enclosing form's pending state.
 */
function FormContent({
  state,
}: {
  state: Awaited<ReturnType<typeof submitJob>> | null
}) {
  const { pending: isPending } = useFormStatus()

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
      {/* Covers the entire relative container (including brand mark + form) */}
      <LoadingOverlay show={isPending} />

      <div className="flex flex-col gap-5">
        {sessionError && (
          <div aria-live="polite">
            <p className="text-sm text-destructive">{sessionError}</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="youtubeUrl"
            className="text-[0.6875rem] uppercase tracking-widest text-muted-foreground font-medium"
          >
            YouTube URL
          </Label>
          <Input
            id="youtubeUrl"
            name="youtubeUrl"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            aria-describedby={urlErrors.length > 0 ? 'youtubeUrl-error' : undefined}
            aria-invalid={urlErrors.length > 0 ? true : undefined}
            disabled={isPending}
            className="h-10"
          />
          {urlErrors.length > 0 && (
            <p id="youtubeUrl-error" className="text-xs text-destructive" role="alert">
              {urlErrors[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="topic"
            className="text-[0.6875rem] uppercase tracking-widest text-muted-foreground font-medium"
          >
            Topic
          </Label>
          <Input
            id="topic"
            name="topic"
            type="text"
            placeholder="e.g. gradient descent, photosynthesis, supply and demand"
            aria-describedby={topicErrors.length > 0 ? 'topic-error' : undefined}
            aria-invalid={topicErrors.length > 0 ? true : undefined}
            disabled={isPending}
            className="h-10"
          />
          {topicErrors.length > 0 && (
            <p id="topic-error" className="text-xs text-destructive" role="alert">
              {topicErrors[0]}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="semanticEnabled"
            name="semanticEnabled"
            value="on"
            disabled={isPending}
          />
          <Label
            htmlFor="semanticEnabled"
            className="text-sm text-muted-foreground font-normal cursor-pointer"
          >
            Also find related references
          </Label>
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="h-10 w-full text-[0.6875rem] font-semibold tracking-widest uppercase mt-1"
        >
          Clip It
        </Button>
      </div>
    </>
  )
}

/**
 * SubmissionForm — client component for the YouTube URL + topic submission flow.
 *
 * Security (T-02-01): router.push('/status') — no query params, no hash, no jobId.
 * Security (T-02-02): Error messages rendered as JSX text nodes, never innerHTML.
 */
export default function SubmissionForm() {
  const router = useRouter()
  const [state, formAction] = useActionState(submitJob, null)

  useEffect(() => {
    if (state && 'jobId' in state && state.jobId) {
      router.push('/status')
    }
  }, [state, router])

  return (
    /*
     * relative — positioning context for the LoadingOverlay rendered inside
     * FormContent. The overlay covers brand mark + form while pending.
     */
    <div className="relative w-full max-w-md">
      <div className="flex flex-col gap-10">
        {/* Brand mark + page heading — outside the <form> for correct semantics */}
        <div>
          <div className="flex items-center gap-2.5 mb-5" aria-hidden="true">
            <span className="text-primary text-base leading-none select-none">▶</span>
            <span className="font-semibold tracking-[0.22em] text-[0.6875rem] uppercase text-foreground/60">
              Clip That
            </span>
          </div>
          <h1 className="text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-foreground">
            Get only the parts<br />that matter.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Paste a video URL and a topic — we&apos;ll find every moment where it&apos;s discussed.
          </p>
        </div>

        <form action={formAction}>
          <FormContent state={state} />
        </form>
      </div>
    </div>
  )
}
