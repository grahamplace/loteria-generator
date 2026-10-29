import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captureImmediate } = vi.hoisted(() => ({
  captureImmediate: vi.fn(async (_event: unknown) => {}),
}));
vi.mock('@/lib/posthog-server', () => ({
  getPostHogClient: () => ({ captureImmediate }),
}));

import { withAITrace, extractUsage } from '@/lib/ai-tracing';

const meta = { userId: 'u1', boardId: 'b1', cardId: 'c1', model: 'gpt-image-2' };

describe('extractUsage', () => {
  it('reads chat completion usage', () => {
    expect(extractUsage({ usage: { prompt_tokens: 10, completion_tokens: 3 } })).toEqual({
      inputTokens: 10,
      outputTokens: 3,
    });
  });

  it('reads Responses / images usage', () => {
    expect(extractUsage({ usage: { input_tokens: 7, output_tokens: 2 } })).toEqual({
      inputTokens: 7,
      outputTokens: 2,
    });
  });

  it('returns nothing for results without usage', () => {
    expect(extractUsage(true)).toEqual({});
    expect(extractUsage(null)).toEqual({});
  });
});

describe('withAITrace', () => {
  beforeEach(() => captureImmediate.mockClear());

  it('returns the result and captures an $ai_generation event', async () => {
    const result = await withAITrace('generate-illustration', meta, async () => ({
      usage: { input_tokens: 100, output_tokens: 50 },
    }));

    expect(result.usage.input_tokens).toBe(100);
    expect(captureImmediate).toHaveBeenCalledOnce();
    expect(captureImmediate.mock.calls[0][0]).toMatchObject({
      distinctId: 'u1',
      event: '$ai_generation',
      properties: {
        $ai_span_name: 'generate-illustration',
        $ai_provider: 'openai',
        $ai_model: 'gpt-image-2',
        $ai_input_tokens: 100,
        $ai_output_tokens: 50,
        $ai_is_error: false,
        board_id: 'b1',
        card_id: 'c1',
      },
    });
  });

  it('captures errors and rethrows them', async () => {
    const err = Object.assign(new Error('blocked'), { status: 400 });
    await expect(
      withAITrace('generate-label', meta, async () => {
        throw err;
      })
    ).rejects.toBe(err);

    expect(captureImmediate.mock.calls[0][0]).toMatchObject({
      properties: { $ai_is_error: true, $ai_error: 'blocked', $ai_http_status: 400 },
    });
  });

  it('does not fail the AI call when PostHog is down', async () => {
    captureImmediate.mockRejectedValueOnce(new Error('network'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(withAITrace('detect-sheet', meta, async () => true)).resolves.toBe(true);
  });
});
