import { z } from 'zod'
import { isYouTubeUrl } from '@/lib/youtube'

export const submitJobSchema = z.object({
  youtubeUrl: z
    .string()
    .url({ message: 'Enter a valid YouTube video URL.' })
    .refine(isYouTubeUrl, { message: 'Enter a valid YouTube video URL.' }),
  topic: z
    .string()
    .min(2, 'Enter at least 2 characters.')
    .max(200, 'Keep it under 200 characters.'),
  semanticEnabled: z.coerce.boolean().optional().default(false),
})
