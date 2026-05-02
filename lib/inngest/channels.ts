import { realtime } from 'inngest';
import { z } from 'zod';

export const cardChannel = realtime.channel({
  name: ({ cardId }: { cardId: string }) => `card:${cardId}`,
  topics: {
    label: {
      schema: z.object({ label: z.string() }),
    },
    illustration: {
      schema: z.object({ illustrationUrl: z.string() }),
    },
    completed: {
      schema: z.object({
        label: z.string(),
        illustrationUrl: z.string(),
      }),
    },
    error: {
      schema: z.object({ message: z.string() }),
    },
  },
});

export const cardChannelTopics = ['label', 'illustration', 'completed', 'error'] as const;

const cardUpdatedSchema = z.object({
  cardId: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'error']),
  illustrationUrl: z.string().url().optional(),
  errorMessage: z.string().nullable().optional(),
});

export type CardUpdatedPayload = z.infer<typeof cardUpdatedSchema>;

export const boardChannel = realtime.channel({
  name: ({ boardId }: { boardId: string }) => `board:${boardId}`,
  topics: {
    cardUpdated: {
      schema: cardUpdatedSchema,
    },
  },
});

export const boardChannelTopics = ['cardUpdated'] as const;
