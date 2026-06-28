/**
 * Optional semantic matching for Phase 6.
 * Embeds a study topic and each transcript segment via Gemini embedding-001,
 * then returns the highest-scoring segments above a cosine similarity threshold.
 * Stateless — single exported function, soft-fail on any API error.
 */

import { GoogleGenAI } from '@google/genai'
import type { TranscriptSegment, ClipMatch } from './types.js'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

const EMBEDDING_MODEL    = 'gemini-embedding-001' // text-embedding-004 shut down Jan 14 2026
const SEMANTIC_THRESHOLD = 0.75                   // cosine similarity floor
const MAX_SEMANTIC_MATCHES = 10                   // cap to bound video length
const EMBED_CHUNK_SIZE   = 20                     // strings per embedContent() call

function assertValidEmbedding(values: number[] | undefined, context: string): number[] {
  if (!values || values.length === 0) {
    throw new Error(`Empty embedding returned for: ${context}`)
  }
  if (values.length !== 768) {
    throw new Error(`Unexpected embedding dimension ${values.length} (expected 768) for: ${context}`)
  }
  return values
}

async function batchEmbed(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += EMBED_CHUNK_SIZE) {
    const chunk = texts.slice(i, i + EMBED_CHUNK_SIZE)
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: chunk,
      config: { taskType: 'SEMANTIC_SIMILARITY' },
    })
    const embeddings = response.embeddings ?? []
    if (embeddings.length !== chunk.length) {
      throw new Error(
        `embedContent chunk mismatch: expected ${chunk.length}, got ${embeddings.length}`,
      )
    }
    results.push(...embeddings.map((e, idx) =>
      assertValidEmbedding(e.values, `chunk item ${idx}`),
    ))
  }
  return results
}

async function embedWithRetry(texts: string[]): Promise<number[][]> {
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      return await batchEmbed(texts)
    } catch (err: unknown) {
      const is429 =
        err instanceof Error && (
          err.message.includes('429') ||
          err.message.includes('RESOURCE_EXHAUSTED')
        )
      if (attempt === 0 && is429) {
        console.warn('  Gemini embed 429 — retrying in 2s...')
        await sleep(2000)
      } else {
        throw err
      }
    }
  }
  throw new Error('unreachable')
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosineSimilarity: vector length mismatch (a=${a.length}, b=${b.length})`
    )
  }
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return magA === 0 || magB === 0
    ? 0
    : dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export async function findSemanticMatches(
  segments: TranscriptSegment[],
  topic: string,
): Promise<ClipMatch[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('  GEMINI_API_KEY not set — skipping semantic matching (soft-fail)')
    return []
  }

  try {
    const topicVec = (await embedWithRetry([topic]))[0]
    const segTexts = segments.map(s => s.text)
    const segVecs  = await embedWithRetry(segTexts)

    return segments
      .map((seg, i) => ({
        seg,
        idx: i,
        score: cosineSimilarity(topicVec, segVecs[i]),
      }))
      .filter(s => s.score >= SEMANTIC_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SEMANTIC_MATCHES)
      .map(({ seg, idx, score }) => ({
        startMs:        Math.round(seg.offset * 1000),
        endMs:          Math.round((seg.offset + seg.duration) * 1000),
        text:           seg.text,
        segmentIndices: [idx],
        matchType:      'semantic' as const,
        confidence:     Math.round(score * 100) / 100,
      }))
  } catch (err) {
    console.error('  findSemanticMatches failed (soft-fail, returning []):', err)
    return []
  }
}
