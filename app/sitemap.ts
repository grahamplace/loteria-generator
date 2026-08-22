import { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loteria-generator-eta.vercel.app';

const indexedRoutes = [
  { path: '/', changeFrequency: 'weekly' as const, priority: 1 },
  { path: '/faq', changeFrequency: 'monthly' as const, priority: 0.8 },
];

function localized(path: string, locale: 'en' | 'es') {
  if (locale === 'en') return `${siteUrl}${path}`;
  return `${siteUrl}/${locale}${path === '/' ? '' : path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return indexedRoutes.flatMap(({ path, changeFrequency, priority }) => {
    const languages = {
      en: localized(path, 'en'),
      'es-MX': localized(path, 'es'),
      'x-default': localized(path, 'en'),
    };
    return [
      {
        url: localized(path, 'en'),
        lastModified: now,
        changeFrequency,
        priority,
        alternates: { languages },
      },
      {
        url: localized(path, 'es'),
        lastModified: now,
        changeFrequency,
        priority,
        alternates: { languages },
      },
    ];
  });
}
