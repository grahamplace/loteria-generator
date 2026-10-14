import { themePages } from '@/lib/themes/catalog';
import { SITE_URL } from '@/lib/site-metadata';
import { MetadataRoute } from 'next';

const siteUrl = SITE_URL;

const indexedRoutes = [
  { path: '/', changeFrequency: 'weekly' as const, priority: 1 },
  { path: '/faq', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/loteria', changeFrequency: 'monthly' as const, priority: 0.8 },
  ...themePages.map((page) => ({
    path: `/loteria/${page.id}`,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
    updatedAt: page.updatedAt,
  })),
];

function localized(path: string, locale: 'en' | 'es') {
  if (locale === 'en') return `${siteUrl}${path}`;
  return `${siteUrl}/${locale}${path === '/' ? '' : path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Map(
    themePages.map((page) => [`/loteria/${page.id}`, new Date(page.updatedAt)])
  );
  return indexedRoutes.flatMap(({ path, changeFrequency, priority }) => {
    const languages = {
      en: localized(path, 'en'),
      'es-MX': localized(path, 'es'),
      'x-default': localized(path, 'en'),
    };
    return [
      {
        url: localized(path, 'en'),
        lastModified: updated.get(path),
        changeFrequency,
        priority,
        alternates: { languages },
      },
      {
        url: localized(path, 'es'),
        lastModified: updated.get(path),
        changeFrequency,
        priority,
        alternates: { languages },
      },
    ];
  });
}
