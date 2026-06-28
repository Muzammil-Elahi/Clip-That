import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { TranscriptSegment } from '../types.js'

// Mock @google/genai at module level before importing semanticMatcher
// vi.mock is hoisted, so the factory runs before imports
const mockEmbedContent = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: function MockGoogleGenAI() {
    return {
      models: {
        embedContent: mockEmbedContent,
      },
    }
  },
}))

// Import after mock so module-level ai client uses the mock
const { findSemanticMatches } = await import('../semanticMatcher.js')

// Helpers — produce a mock embedContent response for given embedding vectors
function makeEmbedResponse(vectors: number[][]): { embeddings: { values: number[] }[] } {
  return { embeddings: vectors.map(values => ({ values })) }
}

// 768-dim zero vector (cosine similarity = 0 with any non-zero vector)
const ZERO_VEC = Array(768).fill(0) as number[]

// Unit vector along first dimension — topic vector
const TOPIC_VEC = [1, ...Array(767).fill(0)] as number[]

// High-similarity segment (same direction as topic)
const HIGH_SIM_VEC = [0.9, ...Array(767).fill(0)] as number[]

// Low-similarity segment (orthogonal to topic — cosine = 0)
const LOW_SIM_VEC = [0, 1, ...Array(766).fill(0)] as number[]

const segments: TranscriptSegment[] = [
  { text: 'Gradient descent minimizes the loss function.', offset: 10, duration: 5, lang: 'en' },
  { text: 'The weather today is quite pleasant.', offset: 20, duration: 4, lang: 'en' },
]

describe('findSemanticMatches', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.GEMINI_API_KEY
  })

  it('Test 1 (MAT-02 happy path): returns only segment 0 when it scores >= 0.75 and segment 1 scores < 0.75', async () => {
    // Call 1: embed topic → TOPIC_VEC; Call 2: embed both segments → HIGH_SIM and LOW_SIM
    mockEmbedContent
      .mockResolvedValueOnce(makeEmbedResponse([TOPIC_VEC]))
      .mockResolvedValueOnce(makeEmbedResponse([HIGH_SIM_VEC, LOW_SIM_VEC]))

    const results = await findSemanticMatches(segments, 'gradient descent')

    expect(results).toHaveLength(1)
    expect(results[0].matchType).toBe('semantic')
    expect(results[0].confidence).toBeGreaterThan(0)
    expect(results[0].confidence).toBeLessThanOrEqual(1)
  })

  it('Test 2 (MAT-03 dedup — segmentIndices use original index): returned segmentIndices reflect original array positions', async () => {
    mockEmbedContent
      .mockResolvedValueOnce(makeEmbedResponse([TOPIC_VEC]))
      .mockResolvedValueOnce(makeEmbedResponse([HIGH_SIM_VEC, LOW_SIM_VEC]))

    const results = await findSemanticMatches(segments, 'gradient descent')

    // Segment 0 (HIGH_SIM) matches — segmentIndices must be [0], the original position
    expect(results[0].segmentIndices).toEqual([0])
  })

  it('Test 3 (MAT-04 field presence): every returned ClipMatch has matchType === "semantic" and numeric confidence in [0,1]', async () => {
    // Two matching segments to confirm field presence is consistent
    const threeSegs: TranscriptSegment[] = [
      { text: 'Backpropagation computes gradients.', offset: 0, duration: 5, lang: 'en' },
      { text: 'Loss function drives learning.', offset: 5, duration: 5, lang: 'en' },
      { text: 'Completely unrelated sentence.', offset: 10, duration: 5, lang: 'en' },
    ]
    mockEmbedContent
      .mockResolvedValueOnce(makeEmbedResponse([TOPIC_VEC]))
      .mockResolvedValueOnce(makeEmbedResponse([HIGH_SIM_VEC, HIGH_SIM_VEC, LOW_SIM_VEC]))

    const results = await findSemanticMatches(threeSegs, 'gradient descent')

    expect(results.length).toBeGreaterThanOrEqual(1)
    for (const match of results) {
      expect(match.matchType).toBe('semantic')
      expect(typeof match.confidence).toBe('number')
      expect(match.confidence).toBeGreaterThanOrEqual(0)
      expect(match.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('Test 4 (soft-fail): embedContent throws on both attempts; findSemanticMatches resolves to []', async () => {
    mockEmbedContent.mockRejectedValue(new Error('API error — not 429'))

    const promise = findSemanticMatches(segments, 'gradient descent')
    // Advance fake timers to clear any retry sleeps
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results).toEqual([])
  })

  it('Test 5 (429 retry): embedContent throws 429 on attempt 0, resolves on attempt 1; returns non-empty result', async () => {
    mockEmbedContent
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValueOnce(makeEmbedResponse([TOPIC_VEC]))
      .mockResolvedValueOnce(makeEmbedResponse([HIGH_SIM_VEC, LOW_SIM_VEC]))

    const promise = findSemanticMatches(segments, 'gradient descent')
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results.length).toBeGreaterThan(0)
  })

  it('Test 6 (API key guard): GEMINI_API_KEY absent; findSemanticMatches returns [] without calling embedContent', async () => {
    delete process.env.GEMINI_API_KEY

    const results = await findSemanticMatches(segments, 'gradient descent')

    expect(results).toEqual([])
    expect(mockEmbedContent.mock.calls.length).toBe(0)
  })
})
