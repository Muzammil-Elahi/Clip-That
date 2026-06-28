/**
 * Unit tests for StatusView Video tab states (Phase 4, Plan 02).
 *
 * Covers:
 * 1. Renders <video> element with correct src when videoUrl is set on a DONE job (D-08)
 * 2. Renders "Working on it..." in Video tab when videoUrl is null and stitchedTranscript is non-empty (D-09)
 * 3. Renders "No clips found for..." in Video tab when videoUrl is null and stitchedTranscript is empty (D-09)
 *
 * Note: base-ui Tabs unmounts inactive panels from the DOM by default (keepMounted=false).
 * Each test clicks the Video tab button to activate the panel before asserting content.
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

const defaultProps = {
  userId: 'user-1',
  initialStatus: 'DONE',
  initialJobId: 'job-1',
  initialErrorMessage: null,
  initialStitchedTranscript: [{ sourceStartMs: 0, sourceEndMs: 5000, text: 'hello' }],
  initialVideoUrl: null,
  initialStudyNotes: null,
  youtubeUrl: 'https://www.youtube.com/watch?v=test',
  topic: 'photosynthesis',
  semanticEnabled: false,
  initialSemanticFailed: false,
}

/** Click the Video tab button to make the Video tab panel active in the DOM. */
function clickVideoTab() {
  const videoTabBtn = screen.getByRole('tab', { name: /video/i })
  fireEvent.click(videoTabBtn)
}

describe('StatusView — Video tab states', () => {
  it('renders <video> with correct src when videoUrl is set', () => {
    render(
      <StatusView
        {...defaultProps}
        initialVideoUrl="https://example.com/signed.mp4"
      />
    )

    clickVideoTab()

    const videoEl = document.querySelector('video')
    expect(videoEl).not.toBeNull()
    expect(videoEl?.getAttribute('src')).toContain('https://example.com/signed.mp4')
  })

  it('renders "Working on it..." in Video tab when videoUrl is null and matches exist', () => {
    render(<StatusView {...defaultProps} initialVideoUrl={null} />)

    clickVideoTab()

    // stitchedTranscript is non-empty, videoUrl is null → Video tab shows "Working on it..."
    expect(screen.getByText('Working on it...')).toBeInTheDocument()
  })

  it('renders "No clips found" message when videoUrl is null and stitchedTranscript is empty', () => {
    render(
      <StatusView
        {...defaultProps}
        initialStitchedTranscript={[]}
        initialVideoUrl={null}
      />
    )

    clickVideoTab()

    expect(screen.getByText(/No clips found for/)).toBeInTheDocument()
  })
})
