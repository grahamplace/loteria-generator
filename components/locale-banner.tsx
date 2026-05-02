import { headers, cookies } from 'next/headers';
import { LocaleBannerClient } from './locale-banner-client';

export function shouldShowBanner(args: {
  cookieLocale: string | undefined;
  acceptLanguage: string | null;
  currentLocale: string;
}): boolean {
  if (args.cookieLocale) return false;
  if (args.currentLocale !== 'en') return false;
  if (!args.acceptLanguage) return false;
  // Match Accept-Language values like "es", "es-MX,...", "es;q=0.9".
  // Must end at a word boundary so "eskimo" doesn't match.
  return /^\s*es(\b|-)/i.test(args.acceptLanguage);
}

export async function LocaleBanner({ currentLocale }: { currentLocale: string }) {
  const h = await headers();
  const c = await cookies();
  const acceptLanguage = h.get('accept-language');
  const cookieLocale = c.get('LOCALE')?.value;

  if (!shouldShowBanner({ cookieLocale, acceptLanguage, currentLocale })) {
    return null;
  }
  return <LocaleBannerClient />;
}
