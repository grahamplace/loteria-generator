/**
 * Prefix on `cards.errorMessage` when OpenAI refused the image on safety
 * grounds (often a copyrighted character). The rest of the message is
 * OpenAI's text, kept for the admin view; users see translated copy.
 */
export const CONTENT_BLOCKED_PREFIX = '[content_blocked] ';

/**
 * Prefix on `cards.errorMessage` when OpenAI has blocked this user's
 * safety_identifier. The block is permanent, so every later AI call for the
 * user would fail too. Users see the same copy as a content block: the
 * original photo still works.
 */
export const IDENTIFIER_BLOCKED_PREFIX = '[identifier_blocked] ';

// Rows saved before the prefix existed carry only OpenAI's text.
const LEGACY_SAFETY_TEXT = 'rejected by the safety system';

export type GenerationErrorKind = 'content_blocked' | 'failed';

/** True for OpenAI's moderation refusal, which retrying cannot fix. */
export function isContentBlocked(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'moderation_blocked';
}

/**
 * True once OpenAI has blocked the request's safety_identifier. OpenAI
 * documents the error only as "identifier blocked", so match the code and the
 * message both.
 */
export function isIdentifierBlocked(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return (
    code === 'identifier_blocked' ||
    (typeof message === 'string' && /identifier[ _]blocked/i.test(message))
  );
}

/** Which user-facing copy a stored card error should get. */
export function generationErrorKind(message: string | null | undefined): GenerationErrorKind {
  if (!message) return 'failed';
  return message.startsWith(CONTENT_BLOCKED_PREFIX) ||
    message.startsWith(IDENTIFIER_BLOCKED_PREFIX) ||
    message.includes(LEGACY_SAFETY_TEXT)
    ? 'content_blocked'
    : 'failed';
}
