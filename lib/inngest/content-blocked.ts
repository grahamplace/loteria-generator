import { NonRetriableError } from 'inngest';
import { CONTENT_BLOCKED_PREFIX, isContentBlocked } from '@/lib/generation-error';

/**
 * `.catch` handler for OpenAI image calls. A safety refusal fails the same way
 * every time, so it skips Inngest's retries (~2 minutes of waiting) and is
 * tagged for the UI. Every other error is rethrown unchanged.
 */
export function stopIfContentBlocked(error: unknown): never {
  if (isContentBlocked(error)) {
    throw new NonRetriableError(`${CONTENT_BLOCKED_PREFIX}${(error as Error).message}`, {
      cause: error,
    });
  }
  throw error;
}
