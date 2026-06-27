import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateStudyNotes } from '../notesGenerator.js'
import type { StitchedTranscriptEntry } from '../types.js'

// Mock @google/genai at module level
const mockGenerateContent = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}))

const entries: StitchedTranscriptEntry[] = [
  { sourceStartMs: 0, sourceEndMs: 5000, text: 'Photosynthesis converts sunlight to energy.' },
]

describe('generateStudyNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    delete process.env.GEMINI_API_KEY
  })

  it('happy path — returns Markdown string when Gemini resolves', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: '## Explanation\nSome notes' })

    const result = await generateStudyNotes(entries, 'photosynthesis')

    expect(typeof result).toBe('string')
    expect(result).toContain('Explanation')
  })

  it('soft-fail — returns null when Gemini throws on both attempts', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API error'))

    const result = await generateStudyNotes(entries, 'photosynthesis')

    expect(result).toBeNull()
  })

  it('retry — returns string when first call throws but second resolves', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('Transient error'))
      .mockResolvedValueOnce({ text: '## Key Points\nA, B' })

    const result = await generateStudyNotes(entries, 'photosynthesis')

    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('missing GEMINI_API_KEY — returns null without calling generateContent', async () => {
    delete process.env.GEMINI_API_KEY

    const result = await generateStudyNotes(entries, 'photosynthesis')

    expect(result).toBeNull()
    expect(mockGenerateContent).not.toHaveBeenCalled()
  })
})
