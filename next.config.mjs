import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/webp'],
    // 75 is the default (card art, hero cards); 50 is for decorative
    // thumbnails rendered at 40-90px. Keep this list minimal — every extra
    // entry is another quality an attacker can force the optimizer to encode.
    qualities: [50, 75],
    // Covers public/ assets and statically imported images (which resolve to
    // /_next/static/media/**). `search: ''` is the point of this entry: without
    // it the optimizer accepts arbitrary query strings, which the Next docs
    // call out as a way to make it optimize URLs you never intended. Nothing
    // optimized here carries a query — the URLs that do (`?w=`, `?v=`) are all
    // auth-gated proxies rendered `unoptimized`.
    localPatterns: [{ pathname: '/**', search: '' }],
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://us-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default withNextIntl(nextConfig);
