/**
 * Unit tests for StatusView Notes tab states (Phase 5, Plan 02).
 *
 * Covers:
 * 1. Renders "Download PDF" button when studyNotes is a non-empty string (State B)
 * 2. Notes tab not visible during PROCESSING state (progress bar shown instead)
 * 3. Renders soft-fail message when job is DONE and studyNotes is null (State C)
 *
 * Note: base-ui Tabs unmounts inactive panels from the DOM by default (keepMounted=false).
 * Each test clicks the Notes tab button to activate the panel before asserting content.
 *
 * PDFDownloadLink and @react-pdf/renderer are mocked to prevent jsdom canvas errors.
 * next/dynamic is mocked so the dynamically imported PDFDownloadLink stub is synchronously available.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import StatusView from '@/components/status-view'

// Mock next/navigation — router.push not needed here but import is required
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock @/lib/supabase/client — Realtime subscription must not make real network calls.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    })),
  }),
}))

// Mock next/dynamic — return a synchronous stub so PDFDownloadLink is available immediately in jsdom.
vi.mock('next/dynamic', () => ({
  default: (_fn: unknown) =>
    function MockPDFDownloadLink({ children }: { children: (s: { loading: boolean }) => React.ReactNode }) {
      return <>{children({ loading: false })}</>
    },
}))

// Mock @react-pdf/renderer — prevents jsdom canvas/PDF API errors.
vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }: { children: (s: { loading: boolean }) => React.ReactNode }) =>
    <>{children({ loading: false })}</>,
  Document: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Page: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  View: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Text: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StyleSheet: { create: (s: unknown) => s },
}))

const defaultProps = {
  userId: 'user-1',
  initialStatus: 'DONE' as const,
  initialJobId: 'job-1',
  initialErrorMessage: null,
  initialStitchedTranscript: [{ sourceStartMs: 0, sourceEndMs: 5000, text: 'hello' }],
  initialVideoUrl: null,
  initialStudyNotes: null,
  youtubeUrl: 'https://www.youtube.com/watch?v=test123',
  topic: 'photosynthesis',
}

/** Click the Notes tab button to make the Notes tab panel active in the DOM. */
function clickNotesTab() {
  const notesTabBtn = screen.getByRole('tab', { name: /notes/i })
  fireEvent.click(notesTabBtn)
}

describe('StatusView — Notes tab states', () => {
  it('renders Download PDF button when studyNotes is a non-empty string', () => {
    render(
      <StatusView
        {...defaultProps}
        initialStudyNotes="## Explanation\nSome notes about photosynthesis"
      />
    )

    clickNotesTab()

    expect(screen.getByText('Download PDF')).toBeInTheDocument()
  })

  it('renders loading text when job is PROCESSING', () => {
    render(
      <StatusView
        {...defaultProps}
        initialStatus="PROCESSING"
        initialStudyNotes={null}
      />
    )

    // PENDING/PROCESSING shows progress bar, not tabs — no tab container in DOM
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('renders soft-fail message when job is DONE and studyNotes is null', () => {
    render(
      <StatusView
        {...defaultProps}
        initialStatus="DONE"
        initialStudyNotes={null}
      />
    )

    clickNotesTab()

    expect(screen.getByText(/Notes could not be generated/)).toBeInTheDocument()
  })
})
