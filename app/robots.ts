import { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loteria-generator-eta.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/boards/', '/account/', '/sign-in', '/sign-up'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
