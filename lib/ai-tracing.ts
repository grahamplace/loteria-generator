import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('loteria-generator');

type AISpanAttributes = {
  userId: string;
  boardId?: string;
  cardId?: string;
  model?: string;
};

export async function withAITrace<T>(
  name: string,
  attributes: AISpanAttributes,
  fn: () => Promise<T>
): Promise<T> {
  const { userId, boardId, cardId, model } = attributes;
  return tracer.startActiveSpan(
    `ai.${name}`,
    {
      attributes: {
        'posthog.distinct_id': userId,
        'ai.user_id': userId,
        ...(boardId && { 'ai.board_id': boardId }),
        ...(cardId && { 'ai.card_id': cardId }),
        ...(model && { 'ai.model': model }),
      },
    },
    async (span) => {
      try {
        return await fn();
      } catch (err) {
        span.recordException(err as Error);
        throw err;
      } finally {
        span.end();
      }
    }
  );
}
