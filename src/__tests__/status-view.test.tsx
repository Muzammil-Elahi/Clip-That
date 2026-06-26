/**
 * Unit tests for StatusView component.
 *
 * Tests cover:
 * 1. Renders progress bar and "Working on it..." heading when initialStatus="PENDING" (JOB-01)
 * 2. Renders "Finding your topic in the video..." as the first status message when PENDING
 * 3. Shows destructive Alert with errorMessage and "Try again" button when FAILED (JOB-02)
 * 4. Does NOT render Progress component when initialStatus="FAILED"
 * 5. Renders "Done!" heading when initialStatus="DONE"
 * 6. "Try again" button invokes router.push('/') when clicked
 * 7. Renders Transcript tab with entries in DONE state (STR-02, STR-03)
 * 8. Renders empty-state message in Transcript tab when stitchedTranscript is empty (D-08)
 * 9. Renders three tabs (Video, Transcript, Notes) in DONE state (D-06)
 *
 * Note: Supabase Realtime live subscription is mocked — integration tested manually.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StatusView from '@/components/status-view'

// Mock next/navigation — router.push is called when "Try again" is clicked
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock @/lib/supabase/client — Realtime subscription must not make real network calls.
// The channel object uses method chaining: channel().on().subscribe() where subscribe()
// returns the channel (so removeChannel receives the correct reference). The from() chain
// is mocked to prevent the polling fallback useEffect from throwing when status is active.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const channel = {
      on: function() { return this },
      subscribe: vi.fn(function() { return this }),
    }
    return {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      })),
    }
  },
}))

const baseProps = {
  userId: 'user-123',
  initialJobId: 'job-456',
  initialErrorMessage: null,
  initialStitchedTranscript: null,
  initialVideoUrl: null,
  topic: 'machine learning',
}

describe('StatusView', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  it('renders progress bar and "Working on it..." heading when initialStatus is PENDING', () => {
    render(<StatusView {...baseProps} initialStatus="PENDING" />)

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText('Working on it...')).toBeInTheDocument()
  })

  it('renders "Finding your topic in the video..." as the first status message when PENDING', () => {
    render(<StatusView {...baseProps} initialStatus="PENDING" />)

    expect(
      screen.getByText('Finding your topic in the video...')
    ).toBeInTheDocument()
  })

  it('shows destructive Alert with errorMessage and "Try again" button when initialStatus is FAILED', () => {
    render(
      <StatusView
        {...baseProps}
        initialStatus="FAILED"
        initialErrorMessage="This video doesn't have a usable transcript."
      />
    )

    // Alert with "Something went wrong" heading
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    // Error message in AlertDescription
    expect(
      screen.getByText("This video doesn't have a usable transcript.")
    ).toBeInTheDocument()
    // "Try again" button
    expect(
      screen.getByRole('button', { name: /try again/i })
    ).toBeInTheDocument()
  })

  it('does NOT render the progress bar when initialStatus is FAILED', () => {
    render(
      <StatusView
        {...baseProps}
        initialStatus="FAILED"
        initialErrorMessage="Something went wrong."
      />
    )

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('renders "Done!" heading when initialStatus is DONE', () => {
    render(<StatusView {...baseProps} initialStatus="DONE" />)

    expect(screen.getByText('Done!')).toBeInTheDocument()
  })

  it('"Try again" button calls router.push("/") when clicked', () => {
    render(
      <StatusView
        {...baseProps}
        initialStatus="FAILED"
        initialErrorMessage="Something went wrong."
      />
    )

    const tryAgainButton = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(tryAgainButton)

    expect(mockPush).toHaveBeenCalledWith('/')
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('renders Transcript tab with entries in DONE state (STR-02, STR-03)', () => {
    const entries = [
      { sourceStartMs: 64000, sourceEndMs: 67000, text: 'machine learning is here' },
    ]
    render(<StatusView {...baseProps} initialStatus="DONE" initialStitchedTranscript={entries} />)

    expect(screen.getByText('[1:04]')).toBeInTheDocument()
    expect(screen.getByText('machine learning is here')).toBeInTheDocument()
  })

  it('renders empty state message in Transcript tab when stitchedTranscript is empty (D-08)', () => {
    render(<StatusView {...baseProps} initialStatus="DONE" initialStitchedTranscript={[]} />)

    expect(screen.getByText(/No mentions of "machine learning" were found/)).toBeInTheDocument()
  })

  it('renders three tabs (Video, Transcript, Notes) in DONE state (D-06)', () => {
    render(<StatusView {...baseProps} initialStatus="DONE" />)

    expect(screen.getByRole('tab', { name: /video/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /transcript/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument()
  })

  it('Video tab shows "No clips found for..." when DONE with empty transcript and no videoUrl (D-09)', () => {
    render(<StatusView {...baseProps} initialStatus="DONE" initialStitchedTranscript={[]} initialVideoUrl={null} />)

    // base-ui Tabs unmounts inactive panels — click Video tab to activate it
    fireEvent.click(screen.getByRole('tab', { name: /video/i }))

    expect(
      screen.getByText(/No clips found for "machine learning"\./)
    ).toBeInTheDocument()
  })

  it('Notes tab shows spec-defined copy when DONE (WR-02)', () => {
    render(<StatusView {...baseProps} initialStatus="DONE" />)

    // base-ui Tabs unmounts inactive panels — click Notes tab to activate it
    fireEvent.click(screen.getByRole('tab', { name: /notes/i }))

    expect(
      screen.getByText('Study notes will appear here in a future update.')
    ).toBeInTheDocument()
  })
})
