import { eventType } from 'inngest';
import { z } from 'zod';

export const cardGenerateRequested = eventType('card/generate.requested', {
  schema: z.object({
    cardId: z.string().uuid(),
    boardId: z.string().uuid(),
    userId: z.string(),
    originalImageUrl: z.string().url(),
    skipLabeling: z.boolean().optional(),
    skipIllustration: z.boolean().optional(),
  }),
});

export const illustrationRegenerateRequested = eventType('card/illustration.regenerate', {
  schema: z.object({
    cardId: z.string().uuid(),
    boardId: z.string().uuid(),
    userId: z.string(),
    originalImageUrl: z.string().url(),
  }),
});
