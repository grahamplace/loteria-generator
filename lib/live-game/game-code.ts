/**
 * Game Codes. See docs/live-play-spec.md §7.
 *
 * Six digits rather than letters: letter *names* diverge between English and
 * Spanish — Spanish "e" sounds like English "a", "i" like "e", "g" like "hey" —
 * and a shouted code in a bilingual room is exactly the use case. Digits are
 * pronounced differently but written identically, and both Lotería products
 * surveyed chose them.
 *
 * Digits also make the usual ambiguous-glyph rule moot: 0/O and 1/I only
 * collide when letters are in the alphabet.
 */
import { GAME_CODE_LENGTH } from '@/lib/constants';

/**
 * Codes nobody wants read aloud at a family party, plus the ones that look like
 * a bug rather than a code. Small on purpose: digits cannot spell slurs, so
 * this is a taste filter, not a safety one.
 */
const DENYLIST = new Set([
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '123456',
  '654321',
  '696969',
  '420420',
  '911911',
]);

const MAX = 10 ** GAME_CODE_LENGTH;

/**
 * One candidate. Uniqueness is not checked here — the caller inserts with
 * `ON CONFLICT DO NOTHING` and retries, because the insert *is* the check and
 * that is what makes it safe under concurrent Game creation.
 */
export function generateGameCode(): string {
  let code: string;
  do {
    code = String(Math.floor(Math.random() * MAX)).padStart(GAME_CODE_LENGTH, '0');
  } while (DENYLIST.has(code));
  return code;
}

export function isValidGameCodeFormat(value: string): boolean {
  return new RegExp(`^\\d{${GAME_CODE_LENGTH}}$`).test(value);
}
