import type { Metadata } from 'next';
import { SITE_URL, ogImages } from '@/lib/site-metadata';
import './globals.css';

// Non-localized routes (/unsubscribe, /redeem, /admin) render under this layout
// only, so it carries English social defaults — there is no i18n context here.
const OG_IMAGE_ALT = 'Lotería Generator — turn your photos into a custom Mexican Lotería set';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    siteName: 'Lotería Generator',
    images: ogImages(OG_IMAGE_ALT),
  },
  twitter: {
    card: 'summary_large_image',
    images: ogImages(OG_IMAGE_ALT),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
