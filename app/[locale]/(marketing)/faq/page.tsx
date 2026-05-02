import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LandingFaq } from '@/components/landing-faq';
import { FAQJsonLd, BreadcrumbJsonLd } from '@/components/json-ld';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loteria-generator-eta.vercel.app';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Marketing.Faq' });
  const tMeta = await getTranslations({ locale, namespace: 'Marketing.Meta' });
  const faqPath = '/faq';
  const enPath = faqPath;
  const esPath = `/es${faqPath}`;
  const canonical = locale === 'en' ? enPath : esPath;
  const ogLocale = locale === 'en' ? 'en_US' : 'es_MX';
  const ogAlternateLocale = locale === 'en' ? 'es_MX' : 'en_US';

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    keywords: t.raw('metaKeywords') as string[],
    alternates: {
      canonical,
      languages: {
        en: enPath,
        'es-MX': esPath,
        'x-default': enPath,
      },
    },
    openGraph: {
      type: 'website',
      locale: ogLocale,
      alternateLocale: ogAlternateLocale,
      url: `${siteUrl}${canonical}`,
      siteName: tMeta('siteName'),
      title: t('metaTitle'),
      description: t('metaDescription'),
    },
  };
}

export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tFaq = await getTranslations('Marketing.Faq');
  const tCta = await getTranslations('Marketing.FinalCta');
  const faqs = tFaq.raw('items') as Array<{ question: string; answer: string }>;

  return (
    <>
      <FAQJsonLd faqs={faqs} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: siteUrl },
          { name: 'FAQ', url: `${siteUrl}/faq` },
        ]}
      />

      {/* FAQ section — same styling as the landing page's #faq section */}
      <section className="border-y border-[var(--color-rule-warm)] bg-[var(--color-cream-deep)] py-16 md:py-20">
        <div className="mx-auto max-w-[980px] px-6 sm:px-8">
          <p className="text-center font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-primary">
            {tFaq('tagline')}
          </p>
          <h1 className="mt-4 text-center font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
            {tFaq('headline')}
          </h1>
          <p className="mx-auto mt-4 max-w-[580px] text-center text-[17px] leading-relaxed text-muted-foreground">
            {tFaq('pageSubtitle')}
          </p>
          <LandingFaq faqs={faqs} />
        </div>
      </section>

      {/* Final CTA — same as landing */}
      <section className="bg-primary py-16 text-center text-white md:py-20">
        <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
          <p className="font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-secondary">
            {tCta('tagline')}
          </p>
          <h2 className="mx-auto mt-4 max-w-[720px] font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-white">
            {tCta('headline')}
          </h2>
          <p className="mx-auto mt-6 max-w-[540px] text-[18px] leading-relaxed text-white/85">
            {tCta('subtitle')}
          </p>
          <Link href="/sign-up" className="mt-8 inline-block">
            <Button
              size="lg"
              className="h-auto rounded-full bg-secondary px-9 py-[18px] text-[17px] font-semibold text-foreground shadow-none hover:bg-white"
            >
              {tCta('cta')}
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
