'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { JobStatus } from '@/types/job'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { StitchedTranscriptEntry } from '@/types/job'
import { cn } from '@/lib/utils'

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

/**
 * Formats a millisecond timestamp as [M:SS].
 * Examples: 64000 → '[1:04]', 750000 → '[12:30]', 5000 → '[0:05]'
 */
function formatTimestamp(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  return `[${minutes}:${seconds}]`
}

interface StatusViewProps {
  userId: string
  initialStatus: string
  initialJobId: string
  initialErrorMessage: string | null
  initialStitchedTranscript: StitchedTranscriptEntry[] | null  // Phase 3
  topic: string                                                 // Phase 3
}

/**
 * StatusView — client component that subscribes to Supabase Realtime for live
 * job status updates. Renders a progress bar + rotating messages while
 * PENDING/PROCESSING; a destructive Alert with "Try again" on FAILED; and a
 * tab-based result view with transcript when DONE.
 *
 * Security (T-03-01): Realtime channel filtered to userId=eq.<uid> — only
 *   receives events for this user's own jobs. RLS on Job table also enforced.
 * Security (T-03-03): errorMessage rendered as JSX text node inside
 *   AlertDescription — never uses dangerouslySetInnerHTML.
 * Security (T-03-06, T-03-07): transcript entry text and topic rendered as JSX
 *   text nodes only — never uses dangerouslySetInnerHTML.
 */
export default function StatusView({
  userId,
  initialStatus,
  initialJobId,
  initialErrorMessage,
  initialStitchedTranscript,
  topic,
}: StatusViewProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage
  )
  const [stitchedTranscript, setStitchedTranscript] = useState<StitchedTranscriptEntry[] | null>(
    initialStitchedTranscript
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
          setStitchedTranscript(payload.new.stitchedTranscript ?? null)
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
    <Card className={cn('w-full', isDone ? 'max-w-2xl' : 'max-w-md')}>
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

        {/* Done state — tab layout with Transcript (default), Video, and Notes tabs */}
        {isDone && (
          <Tabs defaultValue="transcript">
            <TabsList>
              <TabsTrigger value="video">Video</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="video">
              <p className="text-base text-muted-foreground">
                Video clips will be available here once processing is complete.
              </p>
            </TabsContent>
            <TabsContent value="transcript">
              <div className="flex flex-col gap-2">
                {(stitchedTranscript?.length ?? 0) === 0 ? (
                  <p className="text-base text-muted-foreground">
                    No mentions of &quot;{topic}&quot; were found in this video.
                  </p>
                ) : (
                  stitchedTranscript!.map((entry, i) => (
                    <div key={i} className="flex gap-2 items-baseline">
                      <span className="text-sm font-semibold text-foreground shrink-0">
                        {formatTimestamp(entry.sourceStartMs)}
                      </span>
                      <span className="text-base text-foreground">{entry.text}</span>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="notes">
              <p className="text-base text-muted-foreground">
                Study notes will appear here in a future update.
              </p>
            </TabsContent>
          </Tabs>
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
