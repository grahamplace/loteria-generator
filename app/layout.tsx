import React from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { Toaster } from '@/components/ui/sonner';
import { Agentation } from 'agentation';

import './globals.css';

const _geist = Geist({ subsets: ['latin'] });
const _geistMono = Geist_Mono({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loteria-generator.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Loteria Maker - Create Custom Mexican Loteria Cards with AI',
    template: '%s | Loteria Maker',
  },
  description:
    'Create personalized Mexican Loteria cards from your photos using AI. The easiest custom Loteria card maker for weddings, parties, and family events. Transform photos into traditional Loteria-style illustrations instantly.',
  keywords: [
    'custom loteria cards',
    'loteria maker',
    'personalized loteria',
    'mexican loteria generator',
    'loteria card creator',
    'custom mexican bingo',
    'loteria for weddings',
    'loteria party game',
    'AI loteria cards',
    'loteria board maker',
    'personalized bingo cards',
    'mexican loteria printable',
    'custom loteria game',
    'loteria con fotos',
    'loteria personalizada',
  ],
  authors: [{ name: 'Loteria Maker' }],
  creator: 'Loteria Maker',
  publisher: 'Loteria Maker',
  formatDetection: {
    email: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'es_MX',
    url: siteUrl,
    siteName: 'Loteria Maker',
    title: 'Loteria Maker - Create Custom Mexican Loteria Cards with AI',
    description:
      'Transform your photos into beautiful Mexican Loteria cards using AI. Perfect for weddings, parties, and special celebrations. Create personalized Loteria boards in minutes.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Loteria Maker - Custom Mexican Loteria Cards',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Loteria Maker - Create Custom Mexican Loteria Cards with AI',
    description:
      'Transform your photos into beautiful Mexican Loteria cards using AI. Perfect for weddings, parties, and special celebrations.',
    images: ['/og-image.png'],
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
    // Add your verification codes here when you have them
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
  category: 'technology',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <html lang="en">
        <body className={`font-sans antialiased`}>
          {children}
          <Toaster />
          <Analytics />
        </body>
      </html>
      {process.env.NODE_ENV === 'development' && <Agentation />}
    </>
  );
}
