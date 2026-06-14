/**
 * Unit tests for SubmissionForm component.
 *
 * Tests cover:
 * 1. Default render state — inputs and button present
 * 2. URL field error display when state.errors.fieldErrors.youtubeUrl is set
 * 3. Topic field error display when state.errors.fieldErrors.topic is set
 * 4. "Clip It" button not disabled in default state
 *
 * Note: Full submission flow (real Server Actions, routing) is E2E — not tested here.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SubmissionForm from '@/components/submission-form'

// Mock next/navigation — router.push is called on successful submission
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock the Server Action — unit tests must not invoke real server-side code
vi.mock('@/actions/submit-job', () => ({
  submitJob: vi.fn(),
}))

// useActionState is mocked so we can control the state returned to the component.
// The mock returns [state, dispatch, isPending] — we override per-test.
let mockState: unknown = null
let mockPending = false

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useActionState: (_action: unknown, _initial: unknown) => {
      return [mockState, vi.fn(), mockPending]
    },
  }
})

describe('SubmissionForm', () => {
  beforeEach(() => {
    mockState = null
    mockPending = false
    mockPush.mockReset()
  })

  it('renders YouTube URL input, topic input, and Clip It button in default state', () => {
    render(<SubmissionForm />)

    expect(screen.getByLabelText(/youtube video url/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/topic or phrase/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clip it/i })).toBeInTheDocument()
  })

  it('displays URL field error when state.errors.fieldErrors.youtubeUrl is set', () => {
    mockState = {
      errors: {
        fieldErrors: {
          youtubeUrl: ['Enter a valid YouTube video URL.'],
          topic: [],
        },
        formErrors: [],
      },
    }

    render(<SubmissionForm />)

    expect(
      screen.getByText('Enter a valid YouTube video URL.')
    ).toBeInTheDocument()
  })

  it('displays topic field error "Enter at least 2 characters." when set', () => {
    mockState = {
      errors: {
        fieldErrors: {
          youtubeUrl: [],
          topic: ['Enter at least 2 characters.'],
        },
        formErrors: [],
      },
    }

    render(<SubmissionForm />)

    expect(screen.getByText('Enter at least 2 characters.')).toBeInTheDocument()
  })

  it('"Clip It" button is present and not disabled in default state', () => {
    render(<SubmissionForm />)

    const button = screen.getByRole('button', { name: /clip it/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })
})
