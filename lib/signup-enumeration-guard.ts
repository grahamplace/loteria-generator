import { APIError } from 'better-auth/api';

/**
 * Neutral replacement for better-auth's duplicate-signup error.
 *
 * better-auth 1.6.9 answers a sign-up for an existing address with
 * USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL and the plaintext message
 * "User already exists. Use another email."
 * (dist/api/routes/sign-up.mjs:205). Its own generic response — a synthetic
 * user plus a decoy password hash — is gated behind
 * `emailAndPassword.requireEmailVerification` (sign-up.mjs:160), which this app
 * disables so that signup can auto-sign-in and land on /start.
 *
 * So we intercept first and answer with a code that names nothing. This removes
 * the outright disclosure from the response body; it does NOT make sign-up
 * non-enumerable — a duplicate still returns 422 where a fresh address returns
 * 200 with a session. Closing that gap requires gating sign-up behind email
 * verification, which is a product change.
 *
 * Deliberately no decoy password hash: with the status codes still differing,
 * timing equalization buys nothing, and hashing on the duplicate path would let
 * an attacker force scrypt work with every request.
 */
export const GENERIC_SIGN_UP_ERROR_CODE = 'UNABLE_TO_CREATE_ACCOUNT';

const GENERIC_SIGN_UP_ERROR_MESSAGE = 'Unable to create an account with the details provided.';

export type FindUserByEmail = (email: string) => Promise<{ user?: unknown } | null | undefined>;

export async function assertSignUpEmailIsAvailable(
  email: unknown,
  findUserByEmail: FindUserByEmail
): Promise<void> {
  if (typeof email !== 'string') return;
  // better-auth lowercases before its own lookup (sign-up.mjs:163); match it or
  // the guard misses "Taken@Example.com".
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  let existing: Awaited<ReturnType<FindUserByEmail>>;
  try {
    existing = await findUserByEmail(normalized);
  } catch (error) {
    // Fail open. A signup outage is worse than the disclosure this guard
    // removes — better-auth still handles the request, just less quietly.
    console.error('[auth] sign-up existence check failed', error);
    return;
  }

  if (existing?.user) {
    throw APIError.from('UNPROCESSABLE_ENTITY', {
      code: GENERIC_SIGN_UP_ERROR_CODE,
      message: GENERIC_SIGN_UP_ERROR_MESSAGE,
    });
  }
}
