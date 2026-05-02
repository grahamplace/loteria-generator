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
  return children;
}
