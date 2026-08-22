import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.SignIn' });
  const path = '/sign-in';
  const canonical = locale === 'en' ? path : `/${locale}${path}`;
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: { index: false, follow: false },
    alternates: {
      canonical,
      languages: {
        en: path,
        'es-MX': `/es${path}`,
        'x-default': path,
      },
    },
  };
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  // The sign-in page reads ?callbackUrl= with useSearchParams(), which bails the
  // client tree below the nearest <Suspense> boundary out of prerendering — with
  // no boundary the production build fails ("Missing Suspense boundary with
  // useSearchParams"). See node_modules/next/dist/docs/01-app/03-api-reference/
  // 04-functions/use-search-params.md → "Behavior → Prerendering".
  // The boundary lives here rather than inside the page because the whole page
  // is a single 'use client' component that uses the param in both sign-in
  // handlers; this layout is a Server Component, so its fallback is what gets
  // prerendered. The fallback mirrors the page's full-height gradient shell so
  // hydration doesn't shift the layout.
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="min-h-screen bg-gradient-to-b from-orange-50 to-white" />
      }
    >
      {children}
    </Suspense>
  );
}
