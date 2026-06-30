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
import { parseStitchedTranscript } from '@/lib/parseStitchedTranscript'
import Markdown from 'react-markdown'
import dynamic from 'next/dynamic'
import { StudyNotesPDFDocument } from './StudyNotesPDFDocument'
import { Download } from 'lucide-react'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false, loading: () => null }
)

export const STATUS_MESSAGES = [
  'Finding your topic in the video...',
  'Reading through the transcript...',
  'Pulling the right moments...',
  'Building your clip plan...',
  'Almost there...',
]

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
  initialStitchedTranscript: StitchedTranscriptEntry[] | null
  initialVideoUrl: string | null
  topic: string
  initialStudyNotes: string | null
  youtubeUrl: string
  semanticEnabled: boolean
  initialSemanticFailed: boolean
}

/**
 * StatusView — subscribes to Supabase Realtime for live job updates.
 *
 * Security (T-03-01): Realtime channel scoped by job id AND userId.
 * Security (T-03-03): errorMessage rendered as JSX text, never innerHTML.
 * Security (T-03-06, T-03-07): transcript text rendered as JSX text nodes only.
 */
export default function StatusView({
  userId,
  initialStatus,
  initialJobId,
  initialErrorMessage,
  initialStitchedTranscript,
  initialVideoUrl,
  topic,
  initialStudyNotes,
  youtubeUrl,
  semanticEnabled,
  initialSemanticFailed,
}: StatusViewProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage)
  const [stitchedTranscript, setStitchedTranscript] = useState<StitchedTranscriptEntry[] | null>(
    initialStitchedTranscript
  )
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl ?? null)
  const [studyNotes, setStudyNotes] = useState<string | null>(initialStudyNotes ?? null)
  const [notesSettled, setNotesSettled] = useState(initialStatus === JobStatus.DONE)
  const [semanticFailed, setSemanticFailed] = useState(initialSemanticFailed)
  const [messageIndex, setMessageIndex] = useState(0)
  const [progress, setProgress] = useState(() => {
    if (initialStatus === JobStatus.DONE) return 100
    if (initialStatus === JobStatus.FAILED) return 0
    return 10
  })

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
          filter: `id=eq.${initialJobId}&userId=eq.${userId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          setStatus(payload.new.status)
          setErrorMessage(payload.new.errorMessage ?? null)
          setStitchedTranscript(parseStitchedTranscript(payload.new.stitchedTranscript))
          setVideoUrl(payload.new.videoUrl ?? null)
          setStudyNotes(payload.new.studyNotes ?? null)
          setNotesSettled(true)
          setSemanticFailed(payload.new.semanticFailed ?? false)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [initialJobId, userId])

  useEffect(() => {
    const isActive = status === JobStatus.PENDING || status === JobStatus.PROCESSING
    if (!isActive) return

    const supabase = createClient()
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('Job')
        .select('status, errorMessage, stitchedTranscript, videoUrl, studyNotes, semanticFailed')
        .eq('id', initialJobId)
        .single()

      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = data as any
        setStatus(row.status)
        setErrorMessage(row.errorMessage ?? null)
        setStitchedTranscript(parseStitchedTranscript(row.stitchedTranscript))
        setVideoUrl(row.videoUrl ?? null)
        setStudyNotes(row.studyNotes ?? null)
        if (row.status === JobStatus.DONE) setNotesSettled(true)
        setSemanticFailed(row.semanticFailed ?? false)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [status, initialJobId])

  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }

    if (status === JobStatus.DONE) {
      setProgress(100)
    } else if (status === JobStatus.PENDING || status === JobStatus.PROCESSING) {
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

  useEffect(() => {
    const isActive = status === JobStatus.PENDING || status === JobStatus.PROCESSING
    if (!isActive) return

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [status])

  const headingText =
    status === JobStatus.DONE
      ? 'Done!'
      : status === JobStatus.FAILED
        ? 'Something went wrong'
        : 'Working on it...'

  const isActive = status === JobStatus.PENDING || status === JobStatus.PROCESSING
  const isFailed = status === JobStatus.FAILED
  const isDone = status === JobStatus.DONE

  return (
    <div className={cn('w-full', isDone ? 'max-w-2xl' : 'max-w-md')}>
      {/* Brand mark — links home for easy re-submission */}
      <a
        href="/"
        className="flex items-center gap-2.5 mb-6 w-fit group"
        aria-label="Clip That — submit another video"
      >
        <div className="ct-brand-icon group-hover:opacity-80 transition-opacity" aria-hidden="true">▶</div>
        <span className="text-sm font-semibold tracking-tight group-hover:text-muted-foreground transition-colors">
          Clip That
        </span>
      </a>

      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          {/* Status heading */}
          {!isFailed && (
            <div aria-live="polite">
              <h1 className="text-2xl font-semibold leading-tight tracking-tight">{headingText}</h1>
            </div>
          )}

          {/* Progress bar — primary color fill */}
          {(isActive || isDone) && (
            <Progress value={progress} aria-label="Processing progress" />
          )}

          {/* Rotating status message */}
          {isActive && (
            <p className="text-sm text-muted-foreground">{STATUS_MESSAGES[messageIndex]}</p>
          )}

          {/* Semantic matching fallback notice */}
          {isDone && semanticEnabled && semanticFailed && (
            <p className="text-xs text-muted-foreground">
              Related-reference search hit a temporary limit — showing exact matches only.
            </p>
          )}

          {/* Done state */}
          {isDone && (
            <Tabs defaultValue="transcript">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="video">Video</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="video" className="mt-4">
                {!videoUrl && Array.isArray(stitchedTranscript) && stitchedTranscript.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No clips found for &quot;{topic}&quot;.
                  </p>
                ) : videoUrl ? (
                  <video controls src={videoUrl} className="w-full rounded-lg" />
                ) : (
                  <p className="text-sm text-muted-foreground">Working on it...</p>
                )}
              </TabsContent>

              <TabsContent value="transcript" className="mt-4">
                {(stitchedTranscript?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No mentions of &quot;{topic}&quot; were found in this video.
                  </p>
                ) : (
                  /*
                   * Timestamps use .ct-timestamp:
                   *   light → muted-foreground (gray)
                   *   dark  → purple→cyan gradient (via globals.css)
                   */
                  <div className="flex flex-col gap-3">
                    {stitchedTranscript!.map((entry) => (
                      <div key={entry.sourceStartMs} className="flex gap-4 items-baseline">
                        <span className="ct-timestamp font-mono text-xs text-muted-foreground shrink-0 tabular-nums leading-relaxed">
                          {formatTimestamp(entry.sourceStartMs)}
                        </span>
                        <span className="text-sm text-foreground leading-relaxed">{entry.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                {!notesSettled && studyNotes === null && (
                  <div className="flex items-center gap-3">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                    <p className="text-sm text-muted-foreground">Generating your study notes...</p>
                  </div>
                )}
                {studyNotes !== null && (
                  <div className="flex flex-col gap-5">
                    <div className="prose prose-neutral dark:prose-invert max-w-none text-sm">
                      <Markdown>{studyNotes}</Markdown>
                    </div>
                    <PDFDownloadLink
                      document={
                        <StudyNotesPDFDocument
                          topic={topic}
                          studyNotes={studyNotes}
                          youtubeUrl={youtubeUrl}
                        />
                      }
                      fileName={`study-notes-${
                        topic.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '')
                      }.pdf`}
                    >
                      {({ loading }: { loading: boolean }) => (
                        <Button variant="default" size="sm" disabled={loading} className="w-fit">
                          <Download size={13} className="mr-2" />
                          {loading ? 'Preparing...' : 'Download PDF'}
                        </Button>
                      )}
                    </PDFDownloadLink>
                  </div>
                )}
                {notesSettled && studyNotes === null && (
                  <p className="text-sm text-muted-foreground">
                    Notes could not be generated. Your video and transcript are still available.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Failed state */}
          {isFailed && (
            <div className="flex flex-col gap-4">
              <Alert variant="destructive">
                <AlertTitle className="font-semibold">Something went wrong</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              <Button variant="default" onClick={() => router.push('/')} className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
