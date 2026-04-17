import { eventType } from 'inngest';
import { z } from 'zod';

export const cardGenerateRequested = eventType('card/generate.requested', {
  schema: z.object({
    cardId: z.string().uuid(),
    boardId: z.string().uuid(),
    userId: z.string(),
    originalImageUrl: z.string().url(),
  }),
});
