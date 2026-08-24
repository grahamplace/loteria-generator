import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Toaster } from '@/components/ui/sonner';
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider';
import { GoogleAdsTag } from '@/components/google-ads-tag';
import { Agentation } from 'agentation';
import { notFound, redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { routing, type Locale } from '@/i18n/routing';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { userProfiles } from '@/db/schema';
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

  // DB→cookie sync: on first authenticated page load without a LOCALE cookie,
  // read the user's saved locale from user_profiles and redirect if needed.
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('LOCALE')?.value;
  if (!cookieLocale) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) {
      const [profile] = await db
        .select({ locale: userProfiles.locale })
        .from(userProfiles)
        .where(eq(userProfiles.id, session.user.id))
        .limit(1);

      const dbLocale = profile?.locale;
      if (dbLocale === 'es-MX' || dbLocale === 'en') {
        // Next 16 forbids cookieStore.set() inside Server Components — the
        // DB→cookie write needs to live in a Route Handler / Server Action.
        // For now, just redirect when the URL locale doesn't match the saved
        // preference; subsequent loads re-do this DB read until we move the
        // sync elsewhere.
        if (dbLocale !== locale) {
          const target = dbLocale === 'en' ? '/' : '/es';
          redirect(target);
        }
      }
    }
  }

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
