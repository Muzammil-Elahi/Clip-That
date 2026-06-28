/**
 * Study notes generation for Phase 5.
 * Single exported function — no side effects beyond the Gemini API call.
 */

import { GoogleGenAI } from '@google/genai'
import type { StitchedTranscriptEntry } from './types.js'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

function buildPrompt(topic: string, transcriptText: string): string {
  return `You are a study notes generator for students and learners.

The following is a transcript excerpt from a video about "${topic}".
Generate concise, student-focused study notes in Markdown format.

Include these sections (only if the content supports them):
## Explanation
A clear, plain-language explanation of "${topic}" as described in the transcript.

## Key Points
Bullet points covering the most important concepts mentioned.

## Definitions
Define any technical terms or concepts introduced in the excerpt.

Transcript excerpt:
${transcriptText}

Instructions:
- Base your notes only on what the transcript says. Do not add outside knowledge.
- Use simple language suitable for a student reviewing the topic.
- If the transcript does not support a section, omit that section entirely.
- Output only the Markdown notes. No preamble or meta-commentary.`
}

export async function generateStudyNotes(
  entries: StitchedTranscriptEntry[],
  topic: string,
): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('  GEMINI_API_KEY not set — skipping note generation (soft-fail)')
    return null
  }

  const transcriptText = entries.map(e => e.text).join('\n')
  const prompt = buildPrompt(topic, transcriptText)

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      })
      return response.text ?? null
    } catch (err) {
      if (attempt === 0) {
        console.warn('  Gemini attempt 1 failed, retrying in 2s...', err)
        await sleep(2000)
      } else {
        console.error('  Gemini note generation failed after retry:', err)
        return null
      }
    }
  }
  return null
}
