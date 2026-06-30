'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { submitJob } from '@/actions/submit-job'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import LoadingOverlay from '@/components/loading-overlay'

/**
 * FormContent — inside the <form> so useFormStatus() can read pending state.
 * The LoadingOverlay it renders covers the entire outer relative container
 * (brand mark + card) via absolute inset-0.
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
      <LoadingOverlay show={isPending} />

      <div className="flex flex-col gap-4">
        {sessionError && (
          <div aria-live="polite">
            <p className="text-sm text-destructive">{sessionError}</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="youtubeUrl">YouTube URL</Label>
          <Input
            id="youtubeUrl"
            name="youtubeUrl"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            aria-describedby={urlErrors.length > 0 ? 'youtubeUrl-error' : undefined}
            aria-invalid={urlErrors.length > 0 ? true : undefined}
            disabled={isPending}
          />
          {urlErrors.length > 0 && (
            <p id="youtubeUrl-error" className="text-xs text-destructive" role="alert">
              {urlErrors[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="topic">Topic or phrase</Label>
          <Input
            id="topic"
            name="topic"
            type="text"
            placeholder="e.g. gradient descent, photosynthesis"
            aria-describedby={topicErrors.length > 0 ? 'topic-error' : undefined}
            aria-invalid={topicErrors.length > 0 ? true : undefined}
            disabled={isPending}
          />
          {topicErrors.length > 0 && (
            <p id="topic-error" className="text-xs text-destructive" role="alert">
              {topicErrors[0]}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox
            id="semanticEnabled"
            name="semanticEnabled"
            value="on"
            disabled={isPending}
          />
          <Label htmlFor="semanticEnabled" className="font-normal text-muted-foreground cursor-pointer">
            Also find related references
          </Label>
        </div>

        <Button type="submit" disabled={isPending} className="w-full mt-1">
          Clip It
        </Button>
      </div>
    </>
  )
}

/**
 * SubmissionForm — client component for the YouTube URL + topic submission.
 *
 * Security (T-02-01): router.push('/status') — no query params, no jobId in URL.
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
    <div className="w-full max-w-md">
      {/* Brand mark — outside relative container so it stays visible during loading */}
      <div className="flex items-center gap-2.5 mb-6">
        <div className="ct-brand-icon" aria-hidden="true">▶</div>
        <span className="text-sm font-semibold tracking-tight">Clip That</span>
      </div>

      {/*
       * relative — the LoadingOverlay (absolute inset-0) rendered inside FormContent
       * positions here. Card's overflow-hidden clips it to the card's rounded corners.
       */}
      <div className="relative">
        <Card>
          <CardContent className="p-7">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold leading-snug tracking-tight">
                Paste a video.<br />Name a topic.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                We&apos;ll find every moment where it&apos;s discussed — and cut everything else.
              </p>
            </div>

            <form action={formAction}>
              <FormContent state={state} />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
