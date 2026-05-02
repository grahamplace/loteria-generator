// i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'es-MX'] as const,
  defaultLocale: 'en',
  localePrefix: {
    mode: 'as-needed',
    prefixes: { 'es-MX': '/es' },
  },
});

export type Locale = (typeof routing.locales)[number];
