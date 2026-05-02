import { describe, it, expect, vi } from 'vitest';

// Stub out server-only Next.js modules and navigation so we can import the
// pure helper without wiring up a full Next.js runtime.
vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));
vi.mock('@/components/locale-banner-client', () => ({
  LocaleBannerClient: () => null,
}));

import { shouldShowBanner } from '@/components/locale-banner';

describe('shouldShowBanner', () => {
  it('shows when no cookie, accept-language is es-*, and locale is en', () => {
    expect(
      shouldShowBanner({
        cookieLocale: undefined,
        acceptLanguage: 'es-MX,es;q=0.9,en;q=0.8',
        currentLocale: 'en',
      })
    ).toBe(true);
  });

  it('shows for plain "es" header', () => {
    expect(
      shouldShowBanner({
        cookieLocale: undefined,
        acceptLanguage: 'es',
        currentLocale: 'en',
      })
    ).toBe(true);
  });

  it('hides when cookie is already set', () => {
    expect(
      shouldShowBanner({
        cookieLocale: 'en',
        acceptLanguage: 'es-MX',
        currentLocale: 'en',
      })
    ).toBe(false);
  });

  it('hides when accept-language is English', () => {
    expect(
      shouldShowBanner({
        cookieLocale: undefined,
        acceptLanguage: 'en-US,en;q=0.9',
        currentLocale: 'en',
      })
    ).toBe(false);
  });

  it('hides when already rendering Spanish', () => {
    expect(
      shouldShowBanner({
        cookieLocale: undefined,
        acceptLanguage: 'es-MX',
        currentLocale: 'es-MX',
      })
    ).toBe(false);
  });

  it('hides when accept-language header is missing', () => {
    expect(
      shouldShowBanner({
        cookieLocale: undefined,
        acceptLanguage: null,
        currentLocale: 'en',
      })
    ).toBe(false);
  });

  it('does not match "easter" or other es-prefix words (word boundary)', () => {
    // accept-language values are always like "es" or "es-MX,...", not arbitrary words.
    // But guard against any false positives.
    expect(
      shouldShowBanner({
        cookieLocale: undefined,
        acceptLanguage: 'eskimo',
        currentLocale: 'en',
      })
    ).toBe(false);
  });
});
