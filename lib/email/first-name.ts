// lib/email/first-name.ts

/**
 * Capitalize a name token, keeping hyphen/apostrophe compounds readable
 * (e.g. "MARY-ANNE" -> "Mary-Anne", "o'brien" -> "O'Brien").
 */
function titleCase(token: string): string {
  return token
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}

/**
 * Reduce a stored display name to just its first token for friendly greetings
 * (e.g. "Ana Maria Garcia" -> "Ana"). Names stored in all-caps or all-lowercase
 * are normalized to title case so greetings never shout ("MONICA" -> "Monica");
 * names with deliberate internal capitals are left alone ("McKenna", "DeAndre").
 * Returns '' when the name is missing or blank so callers can fall back to a
 * generic greeting.
 */
export function firstName(name: string | null | undefined): string {
  if (!name) return '';
  const first = name.trim().split(/\s+/)[0] ?? '';
  if (!first) return '';

  const hasLower = /\p{Ll}/u.test(first);
  const hasUpper = /\p{Lu}/u.test(first);

  // Mixed case is assumed intentional — leave it as the user typed it.
  if (hasLower && hasUpper) return first;

  return titleCase(first);
}
