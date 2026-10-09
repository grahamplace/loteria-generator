import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { themePages, themeTitle } from '@/lib/themes/catalog';
import { themeVariables } from '@/lib/themes/presets';
import { SITE_URL, ogImages } from '@/lib/site-metadata';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Themes.Page' });
  const url = `${locale === 'es-MX' ? '/es' : ''}/loteria`;
  return {
    title: t('hubTitle'),
    description: t('hubIntro'),
    alternates: {
      canonical: url,
      languages: { en: '/loteria', 'es-MX': '/es/loteria', 'x-default': '/loteria' },
    },
    openGraph: {
      title: t('hubTitle'),
      description: t('hubIntro'),
      url: `${SITE_URL}${url}`,
      type: 'website',
      locale: locale === 'es-MX' ? 'es_MX' : 'en_US',
      images: ogImages(t('hubTitle'), locale),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('hubTitle'),
      description: t('hubIntro'),
      images: ogImages(t('hubTitle'), locale),
    },
  };
}
export default async function ThemesHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Themes.Page');
  return (
    <div className="mx-auto max-w-[1240px] px-6 py-14 sm:px-8 md:py-20">
      <p className="font-mono text-xs tracking-[0.2em] text-primary">{t('hubTag')}</p>
      <h1 className="mt-5 max-w-3xl font-display text-5xl font-bold tracking-tight md:text-7xl">
        {t('hubTitle')}
      </h1>
      <p className="mt-6 max-w-2xl text-xl leading-relaxed text-muted-foreground">
        {t('hubIntro')}
      </p>
      <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {themePages.map((page, index) => (
          <Link
            key={page.id}
            href={`/loteria/${page.id}`}
            style={themeVariables(page.id) as CSSProperties}
            className="theme-surface group overflow-hidden rounded-lg border border-border shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <div className="px-12 pt-8 h-72 overflow-hidden">
              <Image
                src={`/themes/${page.id}/board-1.webp`}
                alt={themeTitle(page, locale)}
                width={1000}
                height={1294}
                sizes="(max-width: 640px) 75vw, 280px"
                preload={index < 3}
                className="w-full h-auto -rotate-3 transition-transform motion-safe:group-hover:rotate-0"
              />
            </div>
            <div className="relative theme-surface px-6 py-5">
              <h2 className="theme-heading text-2xl">
                {page[locale === 'es-MX' ? 'es-MX' : 'en'].name} <span aria-hidden="true">↗</span>
              </h2>
              <p className="mt-2 text-sm">{t('custom')}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
