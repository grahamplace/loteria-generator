import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LocaleBanner } from '@/components/locale-banner';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import grandpaPhoto from '@/scripts/example-images/source-photos/09-grandpa.jpg';
import quinceaneraPhoto from '@/scripts/example-images/source-photos/04-quinceanera.jpg';
import weddingCouplePhoto from '@/scripts/example-images/source-photos/01-wedding-couple.jpg';
import familyPhoto from '@/scripts/example-images/source-photos/07-family-portrait.jpg';
import birthdayCandlesPhoto from '@/scripts/example-images/source-photos/05-birthday-candles.jpg';
import { auth } from '@/lib/auth';
import { LandingHero } from '@/components/landing-hero';
import { HeroCard } from '@/components/hero-card';
import { TablaBoard } from '@/components/tabla-board';
import { heroCards } from '@/lib/hero-cards';
import { LandingFaq } from '@/components/landing-faq';
import {
  WebsiteJsonLd,
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
  FAQJsonLd,
  HowToJsonLd,
} from '@/components/json-ld';
import { BOARD_UNLOCK_PRICE_CENTS, BOARD_UNLOCK_PRICE_DISPLAY } from '@/lib/constants';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = locale === 'en' ? '/' : `/${locale}`;
  return {
    alternates: {
      canonical,
      languages: {
        en: '/',
        'es-MX': '/es',
        'x-default': '/',
      },
    },
  };
}

const occasionCards = [
  { front: 'la-boda', back: 'los-anillos' },
  { front: 'la-quinceanera', back: 'el-ramo' },
  { front: 'la-familia', back: 'el-abuelo' },
  { front: 'el-cumpleanos', back: 'la-guitarra' },
] as const;

const fannedRotations = ['-rotate-[12deg]', '-rotate-[4deg]', 'rotate-[4deg]', 'rotate-[12deg]'];
const fannedOffsets = ['translate-y-0', '-translate-y-3', '-translate-y-3', 'translate-y-0'];

const stepOnePhotos = [weddingCouplePhoto, quinceaneraPhoto, familyPhoto, birthdayCandlesPhoto];

const stackedBoards = [
  { seed: 11, transform: 'translate(-10px, -4px) rotate(-7deg)', z: 'z-0' },
  { seed: 23, transform: 'translate(10px, 4px) rotate(5deg)', z: 'z-10' },
  { seed: 37, transform: 'rotate(-1.5deg)', z: 'z-20' },
];

// Deterministic Park-Miller PRNG so SSR and client agree.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = (s - 1) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    redirect('/dashboard');
  }

  const tHowItWorks = await getTranslations('Marketing.HowItWorks');
  const tOccasions = await getTranslations('Marketing.Occasions');
  const tPricing = await getTranslations('Marketing.Pricing');
  const tFaq = await getTranslations('Marketing.Faq');
  const tCta = await getTranslations('Marketing.FinalCta');
  const tJsonLd = await getTranslations('Marketing.JsonLd');

  const occasionStrings = tOccasions.raw('items') as Array<{
    tag: string;
    title: string;
    copy: string;
  }>;
  const occasions = occasionCards.map((c, i) => ({ ...c, ...occasionStrings[i] }));

  const faqs = (tFaq.raw('items') as Array<{ question: string; answer: string }>).map((item) => ({
    question: item.question,
    answer: item.answer.replaceAll('{price}', BOARD_UNLOCK_PRICE_DISPLAY),
  }));

  const freeFeatures = tPricing.raw('free.features') as string[];
  const unlockedFeatures = tPricing.raw('unlocked.features') as string[];

  const cardById = (id: string) => heroCards.find((c) => c.id === id);
  const finalCtaCards = ['la-boda', 'la-quinceanera', 'la-familia', 'el-cumpleanos']
    .map((id) => cardById(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <>
      <LocaleBanner currentLocale={locale} />
      <WebsiteJsonLd
        name={tJsonLd('siteName')}
        alternateName={tJsonLd.raw('siteAlternateNames') as string[]}
        description={tJsonLd('siteDescription')}
      />
      <OrganizationJsonLd name={tJsonLd('siteName')} />
      <SoftwareApplicationJsonLd
        name={tJsonLd('softwareName')}
        offers={[
          {
            price: '0',
            name: tJsonLd('softwareFreeOfferName'),
            description: tJsonLd('softwareFreeOfferDescription'),
          },
          {
            price: String(BOARD_UNLOCK_PRICE_CENTS / 100),
            name: tJsonLd('softwareUnlockedOfferName'),
            description: tJsonLd('softwareUnlockedOfferDescription'),
          },
        ]}
        featureList={tJsonLd.raw('softwareFeatures') as string[]}
      />
      <FAQJsonLd faqs={faqs} />
      <HowToJsonLd
        name={tJsonLd('howToName')}
        description={tJsonLd('howToDescription')}
        steps={tJsonLd.raw('howToSteps') as Array<{ name: string; text: string; url?: string }>}
        estimatedCostMaxDollars={BOARD_UNLOCK_PRICE_CENTS / 100}
      />

      <LandingHero />

      {/* How It Works — dark inverted */}
      <section
        id="how-it-works"
        className="scroll-mt-20 bg-foreground py-16 text-background md:py-20"
      >
        <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
          <div className="mx-auto max-w-[720px] text-center">
            <p className="font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-secondary">
              {tHowItWorks('tagline')}
            </p>
            <h2 className="mt-4 font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-background">
              {tHowItWorks('headlineLine1')}
              <br />
              {tHowItWorks('headlineLine2')}
            </h2>
            <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-relaxed text-background/70">
              {tHowItWorks('subtitle')}
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:mt-14 md:grid-cols-3">
            <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-9">
              <div className="flex items-start gap-4 md:contents">
                <div className="flex-none font-display text-[72px] font-bold leading-none tracking-[-0.04em] text-primary md:order-1 md:text-[88px]">
                  01
                </div>
                <div className="grid h-[200px] flex-1 place-items-center overflow-hidden md:order-4 md:mt-7 md:h-[260px] md:flex-none md:rounded-xl md:border md:border-dashed md:border-white/15 md:bg-white/[0.04]">
                  <div className="flex" style={{ perspective: '1000px' }} aria-hidden="true">
                    {stepOnePhotos.map((photo, i) => (
                      <div key={i} className={`-mx-4 ${fannedRotations[i]} ${fannedOffsets[i]}`}>
                        <div className="relative h-[120px] w-[80px] overflow-hidden rounded-lg border-[1.5px] border-white/30 bg-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.35)]">
                          <Image
                            src={photo}
                            alt=""
                            fill
                            sizes="80px"
                            placeholder="blur"
                            className="object-cover"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <h3 className="mt-5 font-display text-[22px] font-bold text-background md:order-2">
                {tHowItWorks('step1Title')}
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-background/70 md:order-3">
                {tHowItWorks('step1Desc')}
              </p>
            </article>

            <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-9">
              <div className="flex items-start gap-4 md:contents">
                <div className="flex-none font-display text-[72px] font-bold leading-none tracking-[-0.04em] text-primary md:order-1 md:text-[88px]">
                  02
                </div>
                <div className="relative grid h-[200px] flex-1 place-items-center overflow-hidden md:order-4 md:mt-7 md:h-[260px] md:flex-none md:rounded-xl md:border md:border-dashed md:border-white/15 md:bg-white/[0.04] md:p-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="relative w-[84px] flex-none overflow-hidden rounded-md border-[3px] border-white/40 shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
                      <div className="relative aspect-[2/3]">
                        <Image
                          src={grandpaPhoto}
                          alt={tHowItWorks('step2GrandpaPhotoAlt')}
                          fill
                          sizes="84px"
                          className="object-cover"
                        />
                      </div>
                    </div>
                    <span className="font-jetbrains text-[18px] text-secondary">→</span>
                    <div className="flex-none" style={{ width: 84, height: 145 }}>
                      <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left' }}>
                        {(() => {
                          const c = cardById('el-abuelo');
                          return c ? <HeroCard card={c} duplicate /> : null;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <h3 className="mt-5 font-display text-[22px] font-bold text-background md:order-2">
                {tHowItWorks('step2Title')}
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-background/70 md:order-3">
                {tHowItWorks('step2Desc')}
              </p>
            </article>

            <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-9">
              <div className="flex items-start gap-4 md:contents">
                <div className="flex-none font-display text-[72px] font-bold leading-none tracking-[-0.04em] text-primary md:order-1 md:text-[88px]">
                  03
                </div>
                <div className="grid h-[200px] flex-1 place-items-center overflow-hidden md:order-4 md:mt-7 md:h-[260px] md:flex-none md:rounded-xl md:border md:border-dashed md:border-white/15 md:bg-white/[0.04]">
                  <div className="relative h-full w-[200px] origin-center scale-[0.78] md:scale-100">
                    {stackedBoards.map(({ seed, transform, z }) => {
                      const cards = seededShuffle(heroCards, seed).slice(0, 16);
                      return (
                        <div
                          key={seed}
                          className={`absolute left-1/2 top-1/2 ${z}`}
                          style={{
                            transform: `translate(-50%, -50%) ${transform}`,
                            transformOrigin: 'center center',
                          }}
                        >
                          <TablaBoard cards={cards} width={165} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <h3 className="mt-5 font-display text-[22px] font-bold text-background md:order-2">
                {tHowItWorks('step3Title')}
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-background/70 md:order-3">
                {tHowItWorks('step3Desc')}
              </p>
            </article>
          </div>

          <div className="mt-14 text-center">
            <Link href="/sign-up">
              <Button
                size="lg"
                className="h-auto rounded-full bg-primary px-9 py-[18px] text-[16px] font-semibold text-primary-foreground shadow-[0_8px_18px_-10px_rgba(230,57,70,0.7)] hover:-translate-y-[1px] hover:shadow-[0_12px_22px_-10px_rgba(230,57,70,0.8)]"
              >
                {tHowItWorks('ctaGetStarted')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Occasions */}
      <section id="occasions" className="scroll-mt-20 py-16 md:py-20">
        <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
          <p className="text-center font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-primary">
            {tOccasions('tagline')}
          </p>
          <h2 className="mt-4 text-center font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
            {tOccasions('headlineLine1')}
            <br />
            {tOccasions('headlineLine2')}
          </h2>
          <p className="mx-auto mt-4 max-w-[580px] text-center text-[17px] leading-relaxed text-muted-foreground">
            {tOccasions('subtitle')}
          </p>

          <div className="-mx-6 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 md:mt-14 lg:grid-cols-4">
            {occasions.map((item) => {
              const front = cardById(item.front);
              const back = cardById(item.back);
              return (
                <article
                  key={item.tag}
                  className="group relative w-[82%] flex-none snap-start overflow-hidden rounded-[22px] border border-[var(--color-rule-warm)] bg-[var(--color-cream-deep)] p-7 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_24px_40px_-28px_rgba(26,26,46,0.35)] sm:w-auto"
                >
                  <div className="relative mb-6 grid h-[280px] place-items-center">
                    {back && (
                      <div
                        aria-hidden="true"
                        className="absolute -z-0 translate-x-10 translate-y-5 rotate-[8deg] scale-[0.95] opacity-55"
                      >
                        <HeroCard card={back} duplicate />
                      </div>
                    )}
                    {front && (
                      <div className="relative -rotate-[4deg] scale-[1.25] transition-transform duration-300 group-hover:rotate-0 group-hover:scale-[1.3]">
                        <HeroCard card={front} />
                      </div>
                    )}
                  </div>
                  <span className="font-jetbrains text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                    {item.tag}
                  </span>
                  <h3 className="mt-1.5 font-display text-[22px] font-bold leading-tight tracking-tight text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                    {item.copy}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 pb-16 pt-2 md:pb-20 md:pt-4">
        <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
          <p className="text-center font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-primary">
            {tPricing('tagline')}
          </p>
          <h2 className="mt-4 text-center font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
            {tPricing('headline')}
          </h2>
          <p className="mx-auto mt-4 max-w-[540px] text-center text-[17px] leading-relaxed text-muted-foreground">
            {tPricing('subtitle')}
          </p>

          <div className="mx-auto mt-16 grid max-w-[940px] grid-cols-2 gap-3 md:mt-20 md:gap-6">
            {/* Free Tier */}
            <article className="relative rounded-[22px] border border-[var(--color-rule-warm)] bg-white p-5 sm:p-7 md:p-10">
              <h3 className="font-display text-[18px] font-bold text-foreground md:text-[20px]">
                {tPricing('free.name')}
              </h3>
              <div className="mt-3 flex items-baseline gap-1.5 md:mt-4">
                <span className="font-display text-[40px] font-bold leading-none tracking-[-0.03em] text-foreground md:text-[64px]">
                  {tPricing('free.price')}
                </span>
                <span className="text-xs text-muted-foreground md:text-sm">
                  {tPricing('free.priceLabel')}
                </span>
              </div>
              <ul className="my-5 space-y-2.5 md:my-7 md:space-y-3">
                {freeFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[13px] text-foreground md:gap-2.5 md:text-[14.5px]"
                  >
                    <span aria-hidden="true" className="mt-0.5 font-bold text-accent">
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/sign-up" className="block">
                <Button
                  variant="outline"
                  className="h-auto w-full rounded-full border-[1.5px] border-foreground bg-transparent py-3 text-[14px] font-semibold text-foreground hover:bg-foreground hover:text-background md:py-4 md:text-[15px]"
                >
                  {tPricing('free.cta')}
                </Button>
              </Link>
            </article>

            {/* Unlocked */}
            <article className="relative -translate-y-2 rounded-[22px] border-2 border-foreground bg-primary p-5 text-white sm:p-7 md:p-10">
              <span className="absolute -top-3 right-3 inline-block rounded-full border-2 border-foreground bg-secondary px-2.5 py-1 font-jetbrains text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground md:right-6 md:px-3 md:py-1.5 md:text-[11px] md:tracking-[0.1em]">
                {tPricing('unlocked.badge')}
              </span>
              <h3 className="font-display text-[18px] font-bold text-white md:text-[20px]">
                {tPricing('unlocked.name')}
              </h3>
              <div className="mt-3 flex items-baseline gap-1.5 md:mt-4">
                <span className="font-display text-[40px] font-bold leading-none tracking-[-0.03em] text-white md:text-[64px]">
                  {tPricing('unlocked.price', { price: BOARD_UNLOCK_PRICE_DISPLAY })}
                </span>
                <span className="text-xs text-white/70 md:text-sm">
                  {tPricing('unlocked.priceLabel')}
                </span>
              </div>
              <ul className="my-5 space-y-2.5 md:my-7 md:space-y-3">
                {unlockedFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[13px] text-white md:gap-2.5 md:text-[14.5px]"
                  >
                    <span aria-hidden="true" className="mt-0.5 font-bold text-secondary">
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/sign-up" className="block">
                <Button className="h-auto w-full rounded-full bg-secondary py-3 text-[14px] font-semibold text-foreground shadow-none hover:bg-white hover:text-foreground md:py-4 md:text-[15px]">
                  {tPricing('unlocked.cta')}
                </Button>
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="scroll-mt-20 border-t border-[var(--color-rule-warm)] bg-[var(--color-cream-deep)] py-16 md:py-20"
      >
        <div className="mx-auto max-w-[980px] px-6 sm:px-8">
          <p className="text-center font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-primary">
            {tFaq('tagline')}
          </p>
          <h2 className="mt-4 text-center font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
            {tFaq('headline')}
          </h2>
          <LandingFaq faqs={faqs} />
        </div>
      </section>

      {/* Final CTA */}
      <section id="cta" className="bg-primary py-16 text-center text-white md:py-20">
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

          <div
            className="mt-16 flex justify-center"
            style={{ perspective: '1000px' }}
            aria-hidden="true"
          >
            {finalCtaCards.map((card, i) => {
              const rotations = [
                '-rotate-[12deg]',
                '-rotate-[4deg]',
                'rotate-[4deg]',
                'rotate-[12deg]',
              ];
              const offsets = [
                'translate-y-0',
                '-translate-y-3',
                '-translate-y-3',
                'translate-y-0',
              ];
              return (
                <div key={card.id} className={`-mx-6 ${rotations[i]} ${offsets[i]}`}>
                  <HeroCard card={card} duplicate />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
