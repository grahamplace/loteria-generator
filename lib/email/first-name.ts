// lib/email/first-name.ts

/**
 * Reduce a stored display name to just its first token for friendly greetings
 * (e.g. "Ana Maria Garcia" -> "Ana"). Returns '' when the name is missing or
 * blank so callers can fall back to a generic greeting.
 */
export function firstName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().split(/\s+/)[0] ?? '';
}
