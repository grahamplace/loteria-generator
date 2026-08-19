// __tests__/lib/reset-locale.test.ts
import { describe, it, expect } from 'vitest';
import { localeFromResetUrl } from '@/lib/email/reset-locale';

describe('localeFromResetUrl', () => {
  it('returns es when the callbackURL is under the /es prefix', () => {
    const url =
      'https://app.example.com/api/auth/reset-password/tok1?callbackURL=' +
      encodeURIComponent('/es/reset-password');
    expect(localeFromResetUrl(url)).toBe('es');
  });

  it('returns en for the unprefixed callbackURL', () => {
    const url =
      'https://app.example.com/api/auth/reset-password/tok1?callbackURL=' +
      encodeURIComponent('/reset-password');
    expect(localeFromResetUrl(url)).toBe('en');
  });

  it('returns en when callbackURL is missing', () => {
    expect(localeFromResetUrl('https://app.example.com/api/auth/reset-password/tok1')).toBe('en');
  });

  it('returns en when callbackURL is empty', () => {
    expect(
      localeFromResetUrl('https://app.example.com/api/auth/reset-password/tok1?callbackURL=')
    ).toBe('en');
  });

  it('does not mistake a path that merely starts with the letters es', () => {
    const url =
      'https://app.example.com/api/auth/reset-password/tok1?callbackURL=' +
      encodeURIComponent('/estimates/reset-password');
    expect(localeFromResetUrl(url)).toBe('en');
  });

  it('returns en for a malformed url instead of throwing', () => {
    expect(localeFromResetUrl('not a url at all')).toBe('en');
  });
});
