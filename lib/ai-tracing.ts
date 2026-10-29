import { randomUUID } from 'node:crypto';
import { getPostHogClient } from '@/lib/posthog-server';

type AISpanAttributes = {
  userId: string;
  boardId?: string;
  cardId?: string;
  model?: string;
};

type Usage = { inputTokens?: number; outputTokens?: number };

/**
 * Reads token counts off an OpenAI response. Chat completions report
 * prompt/completion tokens; Responses and images.edit report input/output.
 */
export function extractUsage(result: unknown): Usage {
  const usage = (result as { usage?: Record<string, unknown> } | null)?.usage;
  if (!usage || typeof usage !== 'object') return {};
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  return {
    inputTokens: num(usage.input_tokens) ?? num(usage.prompt_tokens),
    outputTokens: num(usage.output_tokens) ?? num(usage.completion_tokens),
  };
}

/**
 * Runs one AI call and reports it to PostHog AI observability as an
 * `$ai_generation` event (latency, tokens, errors, user attribution).
 * Prompts and outputs are not sent: they carry customer photos.
 */
export async function withAITrace<T>(
  name: string,
  attributes: AISpanAttributes,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  let result: T | undefined;
  let error: unknown;
  try {
    result = await fn();
    return result;
  } catch (err) {
    error = err;
    throw err;
  } finally {
    await captureGeneration(name, attributes, (performance.now() - start) / 1000, result, error);
  }
}

async function captureGeneration(
  name: string,
  { userId, boardId, cardId, model }: AISpanAttributes,
  latencySeconds: number,
  result: unknown,
  error: unknown
) {
  const posthog = getPostHogClient();
  if (!posthog) return;
  const { inputTokens, outputTokens } = extractUsage(result);
  const status = (error as { status?: unknown } | undefined)?.status;
  try {
    // Awaited so the event is sent before a serverless function freezes.
    await posthog.captureImmediate({
      distinctId: userId,
      event: '$ai_generation',
      properties: {
        $ai_trace_id: randomUUID(),
        $ai_span_name: name,
        $ai_provider: 'openai',
        $ai_model: model,
        $ai_latency: latencySeconds,
        $ai_input_tokens: inputTokens,
        $ai_output_tokens: outputTokens,
        $ai_is_error: error !== undefined,
        ...(error !== undefined && {
          $ai_error: error instanceof Error ? error.message : String(error),
        }),
        ...(typeof status === 'number' && { $ai_http_status: status }),
        board_id: boardId,
        card_id: cardId,
      },
    });
  } catch (err) {
    console.warn('ai-tracing: failed to send $ai_generation', err);
  }
}
