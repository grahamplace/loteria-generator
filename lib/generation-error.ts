/**
 * Prefix on `cards.errorMessage` when OpenAI refused the image on safety
 * grounds (often a copyrighted character). The rest of the message is
 * OpenAI's text, kept for the admin view; users see translated copy.
 */
export const CONTENT_BLOCKED_PREFIX = '[content_blocked] ';

// Rows saved before the prefix existed carry only OpenAI's text.
const LEGACY_SAFETY_TEXT = 'rejected by the safety system';

export type GenerationErrorKind = 'content_blocked' | 'failed';

/** True for OpenAI's moderation refusal, which retrying cannot fix. */
export function isContentBlocked(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'moderation_blocked';
}

/** Which user-facing copy a stored card error should get. */
export function generationErrorKind(message: string | null | undefined): GenerationErrorKind {
  if (!message) return 'failed';
  return message.startsWith(CONTENT_BLOCKED_PREFIX) || message.includes(LEGACY_SAFETY_TEXT)
    ? 'content_blocked'
    : 'failed';
}
