import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LandingFaq } from '@/components/landing-faq';
import { FAQJsonLd, BreadcrumbJsonLd } from '@/components/json-ld';
import { faqs } from '@/lib/faq-data';

export const metadata: Metadata = {
  title: 'FAQ — Custom Lotería Card Questions Answered',
  description:
    'Find answers to common questions about creating custom Lotería cards. Learn how it works, pricing, printing, and more.',
  keywords: [
    'loteria faq',
    'custom loteria questions',
    'how to play loteria',
    'loteria card maker help',
    'personalized loteria guide',
  ],
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'FAQ — Custom Lotería Card Questions Answered',
    description:
      'Find answers to common questions about creating custom Lotería cards with our generator.',
  },
};

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loteria-generator-eta.vercel.app';

export default function FAQPage() {
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
            FAQ
          </p>
          <h1 className="mt-4 text-center font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
            Frequently Asked Questions
          </h1>
          <p className="mx-auto mt-4 max-w-[580px] text-center text-[17px] leading-relaxed text-muted-foreground">
            Everything you need to know about creating a custom Lotería set from your photos.
          </p>
          <LandingFaq faqs={faqs} />
        </div>
      </section>

      {/* Final CTA — same as landing */}
      <section className="bg-primary py-16 text-center text-white md:py-20">
        <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
          <p className="font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-secondary">
            ¿Listo?
          </p>
          <h2 className="mx-auto mt-4 max-w-[720px] font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-white">
            Try it for free
          </h2>
          <p className="mx-auto mt-6 max-w-[540px] text-[18px] leading-relaxed text-white/85">
            No credit card required to try. Just upload a photo and watch your first Lotería card
            come to life in under a minute.
          </p>
          <Link href="/sign-up" className="mt-8 inline-block">
            <Button
              size="lg"
              className="h-auto rounded-full bg-secondary px-9 py-[18px] text-[17px] font-semibold text-foreground shadow-none hover:bg-white"
            >
              Create your set →
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
