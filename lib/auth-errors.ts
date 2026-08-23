/**
 * better-auth error objects -> i18n message keys.
 *
 * The auth pages used to render `result.error.message` directly, which printed
 * better-auth's "User already exists. Use another email." on the public sign-up
 * form — a free account-existence oracle, and untranslated English on a
 * localized page. Nothing here reads `.message`: upstream copy must never reach
 * the screen.
 *
 * Every server-side sign-up failure deliberately maps to the SAME key. Giving
 * the duplicate-email case its own message would just rebuild the oracle in our
 * own words.
 */

export type AuthClientError =
  | { status?: number; code?: string; message?: string }
  | null
  | undefined;

export type SignUpErrorKey = 'rateLimited' | 'signUpFailed';
export type SignInErrorKey = 'rateLimited' | 'invalidCredentials' | 'unexpectedError';

function isRateLimited(error: AuthClientError): boolean {
  return error?.status === 429;
}

export function signUpErrorKey(error: AuthClientError): SignUpErrorKey {
  return isRateLimited(error) ? 'rateLimited' : 'signUpFailed';
}

export function signInErrorKey(error: AuthClientError): SignInErrorKey {
  if (isRateLimited(error)) return 'rateLimited';
  const status = error?.status;
  // better-auth answers both "no such user" and "wrong password" with
  // INVALID_EMAIL_OR_PASSWORD, so one message covers every client-side
  // rejection without narrowing which half failed.
  if (typeof status === 'number' && status >= 400 && status < 500) return 'invalidCredentials';
  return 'unexpectedError';
}
