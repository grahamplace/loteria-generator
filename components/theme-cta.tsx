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
  tinted = false,
  children,
}: {
  theme: ThemeId;
  mode: PhotoMode;
  /** Use the preset's own colors so side-by-side variants are distinguishable. */
  tinted?: boolean;
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
      style={
        tinted
          ? {
              backgroundColor: `var(--loteria-${theme}-ink)`,
              color: `var(--loteria-${theme}-paper)`,
            }
          : undefined
      }
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-7 py-3 text-base font-semibold shadow-md transition-[background-color,opacity] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${
        tinted ? 'hover:opacity-90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
      }`}
    >
      {children}
      <span aria-hidden="true" className="ml-3">
        →
      </span>
    </Link>
  );
}

export function ThemeVisit({ theme, mode }: { theme: string; mode: PhotoMode }) {
  const locale = useLocale();
  useEffect(() => {
    posthog.capture('theme_page_viewed', { theme, photo_mode: mode, locale });
  }, [theme, mode, locale]);
  return null;
}
