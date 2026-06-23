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
    cropData: z
      .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
      .optional(),
  }),
});

export const illustrationRegenerateRequested = eventType('card/illustration.regenerate', {
  schema: z.object({
    cardId: z.string().uuid(),
    boardId: z.string().uuid(),
    userId: z.string(),
    originalImageUrl: z.string().url(),
    promptOverlay: z.string().optional(),
  }),
});

export const campaignEmailRequested = eventType('admin/campaign-email.requested', {
  schema: z.object({
    templateKey: z.string(),
    userIds: z.array(z.string()).min(1),
  }),
});
