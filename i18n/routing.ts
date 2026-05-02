// i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'es'] as const,
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];

// HTML/hreflang token mapping. URL token is `es`, but the html `lang` attribute
// and hreflang use `es-MX` (more specific; helps Google geo-target Latin
// American queries since the brand is Mexican Lotería).
export const htmlLang: Record<Locale, string> = {
  en: 'en',
  es: 'es-MX',
};
