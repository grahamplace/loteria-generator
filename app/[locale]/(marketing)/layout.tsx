import { LandingNav } from '@/components/landing-nav';
import { LandingFooter } from '@/components/landing-footer';
import { setRequestLocale } from 'next-intl/server';

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <a
        href="#marketing-main"
        className="sr-only focus:not-sr-only focus:block focus:p-4 focus:text-primary"
      >
        {locale === 'es-MX' ? 'Ir al contenido' : 'Skip to content'}
      </a>
      <LandingNav />
      <main id="marketing-main" tabIndex={-1}>
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
