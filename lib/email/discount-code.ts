// lib/email/discount-code.ts
import { randomInt } from 'crypto';
import { SIGNUP_NUDGE_CODE_PREFIX } from '@/lib/constants';

// Crockford-ish: no I, O, 0, 1 to avoid human transcription errors.
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateDiscountCode(
  prefix: string = SIGNUP_NUDGE_CODE_PREFIX,
  length = 6
): string {
  let body = '';
  for (let i = 0; i < length; i++) {
    body += CHARSET[randomInt(CHARSET.length)];
  }
  return `${prefix}-${body}`;
}
