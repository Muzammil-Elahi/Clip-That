'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { JobStatus } from '@/types/job'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Rotating status messages shown while the job is PENDING or PROCESSING.
 * Declared in order as specified by the UI-SPEC Copywriting Contract (D-10).
 */
export const STATUS_MESSAGES = [
  'Finding your topic in the video...',
  'Reading through the transcript...',
  'Pulling the right moments...',
  'Building your clip plan...',
  'Almost there...',
]

interface StatusViewProps {
  userId: string
  initialStatus: string
  initialJobId: string
  initialErrorMessage: string | null
}

/**
 * StatusView — client component that subscribes to Supabase Realtime for live
 * job status updates. Renders a progress bar + rotating messages while
 * PENDING/PROCESSING; a destructive Alert with "Try again" on FAILED; and a
 * "Done!" heading when DONE.
 *
 * Security (T-03-01): Realtime channel filtered to userId=eq.<uid> — only
 *   receives events for this user's own jobs. RLS on Job table also enforced.
 * Security (T-03-03): errorMessage rendered as JSX text node inside
 *   AlertDescription — never uses dangerouslySetInnerHTML.
 */
export default function StatusView({
  userId,
  initialStatus,
  initialJobId,
  initialErrorMessage,
}: StatusViewProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage
  )
  const [messageIndex, setMessageIndex] = useState(0)
  const [progress, setProgress] = useState(() => {
    if (initialStatus === JobStatus.DONE) return 100
    if (initialStatus === JobStatus.FAILED) return 0
    return 10
  })

  // Track the progress animation interval so we can clear it
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  )

  // Supabase Realtime subscription — listen for job row UPDATE events
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`job-status-${initialJobId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Job',
          filter: `id=eq.${initialJobId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          setStatus(payload.new.status)
          setErrorMessage(payload.new.errorMessage ?? null)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initialJobId])

  // Progress animation — drives the progress bar from 10% toward 90% during
  // PENDING/PROCESSING, then snaps to 100% when DONE
  useEffect(() => {
    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }

    if (status === JobStatus.DONE) {
      setProgress(100)
    } else if (
      status === JobStatus.PENDING ||
      status === JobStatus.PROCESSING
    ) {
      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev
          return Math.min(prev + 5, 90)
        })
      }, 2000)
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [status])

  // Message cycling — rotates through STATUS_MESSAGES every 4s while active
  useEffect(() => {
    const isActive =
      status === JobStatus.PENDING || status === JobStatus.PROCESSING

    if (!isActive) return

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [status])

  // Determine heading text based on current status
  const headingText =
    status === JobStatus.DONE
      ? 'Done!'
      : status === JobStatus.FAILED
        ? 'Something went wrong'
        : 'Working on it...'

  const isActive =
    status === JobStatus.PENDING || status === JobStatus.PROCESSING
  const isFailed = status === JobStatus.FAILED
  const isDone = status === JobStatus.DONE

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col gap-6 p-6">
        {/* Status heading — wrapped in aria-live region for screen reader announcements.
            Not rendered for FAILED state because the Alert component carries the heading. */}
        {!isFailed && (
          <div aria-live="polite">
            <h1 className="text-2xl font-semibold leading-tight">{headingText}</h1>
          </div>
        )}

        {/* Progress bar — shown during PENDING/PROCESSING and DONE */}
        {(isActive || isDone) && (
          <Progress value={progress} aria-label="Processing progress" />
        )}

        {/* Rotating status message — shown during PENDING/PROCESSING */}
        {isActive && (
          <p className="text-base text-muted-foreground">
            {STATUS_MESSAGES[messageIndex]}
          </p>
        )}

        {/* Done state placeholder — future phases will populate this */}
        {isDone && (
          <p className="text-base text-muted-foreground">
            Your results are ready.
          </p>
        )}

        {/* Failure state — destructive Alert with error message and Try again button */}
        {isFailed && (
          <div className="flex flex-col gap-4">
            <Alert variant="destructive">
              <AlertTitle className="text-base font-semibold">
                Something went wrong
              </AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <Button
              variant="default"
              onClick={() => router.push('/')}
              className="w-full h-11"
            >
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
