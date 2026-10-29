/**
 * OpenAI attributes policy violations to this ID instead of our whole API key,
 * so one user's unsafe upload gets that user blocked, not every user. Pass it
 * on every OpenAI call made on a user's behalf.
 *
 * Spread form because openai@6.16 doesn't type `safety_identifier` on
 * images.edit yet, though the API accepts it there.
 */
export function safetyIdentifier(userId: string): { safety_identifier: string } {
  return { safety_identifier: userId };
}
