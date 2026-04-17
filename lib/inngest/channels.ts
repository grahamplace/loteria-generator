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
