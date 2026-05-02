import React from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono, Caveat, Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { Toaster } from '@/components/ui/sonner';
import { Agentation } from 'agentation';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing, htmlLang, type Locale } from '@/i18n/routing';

const _geist = Geist({ subsets: ['latin'] });
const _geistMono = Geist_Mono({ subsets: ['latin'] });
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loteria-generator-eta.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Lotería Generator - Create Custom Mexican Lotería Cards from Your Photos',
    template: '%s | Lotería Generator',
  },
  description:
    'Create personalized Mexican Lotería cards from your photos. The easiest custom Lotería card maker for weddings, parties, and family events. Transform photos into traditional Lotería-style illustrations instantly.',
  keywords: [
    'custom loteria cards',
    'loteria generator',
    'personalized loteria',
    'mexican loteria generator',
    'loteria card creator',
    'custom mexican bingo',
    'loteria for weddings',
    'loteria party game',
    'loteria from photos',
    'loteria board maker',
    'personalized bingo cards',
    'mexican loteria printable',
    'custom loteria game',
    'loteria con fotos',
    'loteria personalizada',
  ],
  authors: [{ name: 'Lotería Generator' }],
  creator: 'Lotería Generator',
  publisher: 'Lotería Generator',
  formatDetection: {
    email: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'es_MX',
    url: siteUrl,
    siteName: 'Lotería Generator',
    title: 'Lotería Generator - Create Custom Mexican Lotería Cards from Your Photos',
    description:
      'Transform your photos into beautiful Mexican Lotería cards. Perfect for weddings, parties, and special celebrations. Create personalized Lotería boards in minutes.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lotería Generator - Create Custom Mexican Lotería Cards from Your Photos',
    description:
      'Transform your photos into beautiful Mexican Lotería cards. Perfect for weddings, parties, and special celebrations.',
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
  icons: {
    icon: '/icon.ico',
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
  },
  category: 'technology',
};

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
    <html lang={htmlLang[locale as Locale]}>
      <body
        className={`font-sans antialiased ${caveat.variable} ${bricolage.variable} ${jetbrains.variable}`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Toaster />
        <Analytics />
        {process.env.NODE_ENV === 'development' && <Agentation />}
      </body>
    </html>
  );
}
