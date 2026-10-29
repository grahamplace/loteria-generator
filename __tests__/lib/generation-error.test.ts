import { describe, it, expect } from 'vitest';
import { NonRetriableError } from 'inngest';
import {
  CONTENT_BLOCKED_PREFIX,
  generationErrorKind,
  isContentBlocked,
} from '@/lib/generation-error';
import { stopIfContentBlocked } from '@/lib/inngest/content-blocked';

const SAFETY_MESSAGE =
  '400 Your request was rejected by the safety system. If you believe this is an error, contact us at help.openai.com and include the request ID req_abc.';

function openAIError(code: string, message = SAFETY_MESSAGE) {
  return Object.assign(new Error(message), { status: 400, code });
}

describe('isContentBlocked', () => {
  it('is true for OpenAI moderation refusals', () => {
    expect(isContentBlocked(openAIError('moderation_blocked'))).toBe(true);
  });

  it('is false for other API errors', () => {
    expect(isContentBlocked(openAIError('billing_hard_limit_reached'))).toBe(false);
    expect(isContentBlocked(new Error('network'))).toBe(false);
    expect(isContentBlocked(null)).toBe(false);
  });
});

describe('generationErrorKind', () => {
  it('recognizes tagged messages', () => {
    expect(generationErrorKind(`${CONTENT_BLOCKED_PREFIX}${SAFETY_MESSAGE}`)).toBe(
      'content_blocked'
    );
  });

  it('recognizes untagged safety messages saved before the tag existed', () => {
    expect(generationErrorKind(SAFETY_MESSAGE)).toBe('content_blocked');
  });

  it('treats anything else as a generic failure', () => {
    expect(generationErrorKind('400 Billing hard limit has been reached.')).toBe('failed');
    expect(generationErrorKind('')).toBe('failed');
    expect(generationErrorKind(undefined)).toBe('failed');
  });
});

describe('stopIfContentBlocked', () => {
  it('turns a moderation refusal into a tagged non-retriable error', () => {
    const cause = openAIError('moderation_blocked');
    let thrown: unknown;
    try {
      stopIfContentBlocked(cause);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(NonRetriableError);
    expect((thrown as Error).message).toBe(`${CONTENT_BLOCKED_PREFIX}${SAFETY_MESSAGE}`);
    expect((thrown as NonRetriableError).cause).toBe(cause);
  });

  it('rethrows other errors unchanged so Inngest retries them', () => {
    const other = openAIError('rate_limit_exceeded', '429 slow down');
    expect(() => stopIfContentBlocked(other)).toThrow(other);
  });
});
