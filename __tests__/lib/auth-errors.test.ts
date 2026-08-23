import { describe, it, expect } from 'vitest';
import { signUpErrorKey, signInErrorKey } from '@/lib/auth-errors';

// The exact payload better-auth 1.6.9 returns for a duplicate sign-up
// (dist/api/routes/sign-up.mjs:205). Rendering `message` here is the bug.
const DUPLICATE_EMAIL_ERROR = {
  status: 422,
  code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
  message: 'User already exists. Use another email.',
};

describe('signUpErrorKey', () => {
  it('maps a duplicate-email error to the generic failure key', () => {
    expect(signUpErrorKey(DUPLICATE_EMAIL_ERROR)).toBe('signUpFailed');
  });

  it('maps an unrelated server failure to the same generic key', () => {
    // Indistinguishable on purpose: a distinct key would re-create the oracle.
    expect(signUpErrorKey({ status: 422, code: 'FAILED_TO_CREATE_USER' })).toBe('signUpFailed');
    expect(signUpErrorKey({ status: 500 })).toBe('signUpFailed');
    expect(signUpErrorKey(null)).toBe('signUpFailed');
    expect(signUpErrorKey(undefined)).toBe('signUpFailed');
  });

  it('surfaces rate limiting separately', () => {
    expect(signUpErrorKey({ status: 429, message: 'Too many requests' })).toBe('rateLimited');
  });
});

describe('signInErrorKey', () => {
  it('maps any 4xx credential rejection to one message', () => {
    expect(signInErrorKey({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      'invalidCredentials'
    );
    expect(signInErrorKey({ status: 404, code: 'USER_NOT_FOUND' })).toBe('invalidCredentials');
  });

  it('surfaces rate limiting separately', () => {
    expect(signInErrorKey({ status: 429 })).toBe('rateLimited');
  });

  it('falls back to the unexpected-error key for server failures', () => {
    expect(signInErrorKey({ status: 500 })).toBe('unexpectedError');
    expect(signInErrorKey(null)).toBe('unexpectedError');
  });
});
