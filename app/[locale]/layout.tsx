import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Toaster } from '@/components/ui/sonner';
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider';
import { GoogleAdsTag } from '@/components/google-ads-tag';
import { Agentation } from 'agentation';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { routing, type Locale } from '@/i18n/routing';
import { fontVariables } from '@/lib/fonts';
import { SITE_URL, THEME_COLOR, ogImages } from '@/lib/site-metadata';

export function generateViewport(): Viewport {
  return { themeColor: THEME_COLOR };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Marketing.Meta' });

  // localePrefix: 'as-needed' → English at '/', Spanish at '/es'
  const localePathRoot = locale === routing.defaultLocale ? '' : '/es';
  const canonical = localePathRoot || '/';

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('title'), template: `%s | ${t('siteName')}` },
    description: t('description'),
    keywords: t.raw('keywords') as string[],
    alternates: {
      canonical,
      languages: {
        en: '/',
        'es-MX': '/es',
        'x-default': '/',
      },
    },
    authors: [{ name: t('siteName') }],
    creator: t('siteName'),
    publisher: t('siteName'),
    formatDetection: { email: false, telephone: false },
    openGraph: {
      type: 'website',
      locale: locale === 'en' ? 'en_US' : 'es_MX',
      alternateLocale: locale === 'en' ? 'es_MX' : 'en_US',
      url: `${SITE_URL}${canonical}`,
      siteName: t('siteName'),
      title: t('ogTitle'),
      description: t('ogDescription'),
      images: ogImages(t('ogImageAlt'), locale),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('twitterTitle'),
      description: t('twitterDescription'),
      images: ogImages(t('ogImageAlt'), locale),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    icons: { icon: '/icon.ico' },
    appleWebApp: { capable: true, title: t('siteName'), statusBarStyle: 'default' },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      yandex: process.env.YANDEX_VERIFICATION,
    },
    category: 'technology',
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`font-sans antialiased ${fontVariables}`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <OnboardingProvider>{children}</OnboardingProvider>
        </NextIntlClientProvider>
        <Toaster />
        <Analytics />
        <GoogleAdsTag />
        {process.env.NODE_ENV === 'development' && <Agentation />}
      </body>
    </html>
  );
}
