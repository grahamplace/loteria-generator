'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { useLocale } from 'next-intl';
import { themeStartPath } from '@/lib/theme-entry';
import type { ThemeId, PhotoMode } from '@/lib/themes/presets';
export function ThemeCta({
  theme,
  mode,
  children,
}: {
  theme: ThemeId;
  mode: PhotoMode;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const callback = themeStartPath(theme, mode, locale);
  return (
    <Link
      href={`${locale === 'es-MX' ? '/es' : ''}/sign-up?callbackUrl=${encodeURIComponent(callback)}`}
      onClick={() => {
        posthog.register({ landing_theme: theme, landing_locale: locale });
        posthog.capture('theme_cta_clicked', { theme, photo_mode: mode, locale });
      }}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-7 py-3 text-base font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      {children}
      <span aria-hidden="true" className="ml-3">
        →
      </span>
    </Link>
  );
}

export function ThemeVisit({ theme, mode }: { theme: ThemeId; mode: PhotoMode }) {
  const locale = useLocale();
  useEffect(() => {
    posthog.capture('theme_page_viewed', { theme, photo_mode: mode, locale });
  }, [theme, mode, locale]);
  return null;
}
