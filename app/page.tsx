import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import grandpaPhoto from '@/scripts/example-images/source-photos/09-grandpa.jpg';
import quinceaneraPhoto from '@/scripts/example-images/source-photos/04-quinceanera.jpg';
import weddingCouplePhoto from '@/scripts/example-images/source-photos/01-wedding-couple.jpg';
import familyPhoto from '@/scripts/example-images/source-photos/07-family-portrait.jpg';
import birthdayCakePhoto from '@/scripts/example-images/source-photos/06-birthday-cake.jpg';
import { auth } from '@/lib/auth';
import { LandingHero } from '@/components/landing-hero';
import { LandingNav } from '@/components/landing-nav';
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

export const metadata = {
  alternates: {
    canonical: '/',
  },
};

const faqs = [
  {
    question: 'What is Lotería and how do you play it?',
    answer:
      'Lotería is a traditional Mexican game of chance, similar to bingo. Players use boards (tablas) with a 4x4 grid of images. A caller (cantor) draws cards and announces them, and players mark matching images on their boards. The first to complete a pattern wins!',
  },
  {
    question: 'How do I create a custom Lotería set with my own photos?',
    answer:
      'Upload your photos and our AI restyles each one into a traditional Lotería-style illustration with a Spanish label. You then arrange your cards, edit labels, and generate printable tablas (boards) so you have a complete Lotería set ready to play.',
  },
  {
    question: 'Can I use this for my wedding or party?',
    answer:
      'Absolutely! A custom Lotería set is perfect for weddings, quinceañeras, birthday parties, family reunions, and any special celebration. Personalize the cards with your guests, memorable moments, or themed photos — and print tablas for everyone at the party.',
  },
  {
    question: 'How many cards can I create?',
    answer:
      'With the free preview, you can create up to 4 cards and generate one sample board. By unlocking your board for $5, you get access to 54 cards (a full traditional Lotería deck) and unlimited board generations.',
  },
  {
    question: 'What file formats can I export?',
    answer:
      'You can export your Lotería boards as high-quality printable PDFs, perfect for home or professional printing. Individual cards can also be downloaded as images.',
  },
  {
    question: 'Is there a subscription or recurring fee?',
    answer:
      "No subscriptions! Our pricing is simple — try for free, and when you're ready, pay a one-time $5 fee to unlock your board. That purchase gives you permanent access to that project.",
  },
];

const occasions = [
  {
    tag: 'Wedding',
    title: 'For the bride & groom',
    copy: 'Photos of the couple, the wedding party, both families. A keepsake guests genuinely take home.',
    front: 'la-boda',
    back: 'la-sortija',
  },
  {
    tag: 'Quinceañera',
    title: 'Made for her court',
    copy: 'The quinceañera, her chambelanes, damas, and padrinos — everyone gets their card.',
    front: 'la-quinceanera',
    back: 'el-ramo',
  },
  {
    tag: 'Reunion',
    title: 'Every primo & tía',
    copy: 'Build a deck for the whole familia. From abuela to the new baby — everyone will love playing Lotería with a custom set.',
    front: 'la-familia',
    back: 'el-abuelo',
  },
  {
    tag: 'Birthday',
    title: 'The whole crew',
    copy: 'Friends, inside jokes, and the birthday star front-and-center.',
    front: 'las-velitas',
    back: 'la-fiesta',
  },
] as const;

const showcaseTilts = [-3, 2, -1, 4, -2, 1, -4, 3, 2, -3, 1, -2, 3, -1, 4, -3, 2, -2];

const fannedRotations = ['-rotate-[12deg]', '-rotate-[4deg]', 'rotate-[4deg]', 'rotate-[12deg]'];
const fannedOffsets = ['translate-y-0', '-translate-y-3', '-translate-y-3', 'translate-y-0'];

const stepOnePhotos = [weddingCouplePhoto, quinceaneraPhoto, familyPhoto, birthdayCakePhoto];

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

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    redirect('/dashboard');
  }

  const cardById = (id: string) => heroCards.find((c) => c.id === id);
  const finalCtaCards = ['la-boda', 'la-quinceanera', 'la-familia', 'las-velitas']
    .map((id) => cardById(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <>
      <WebsiteJsonLd />
      <OrganizationJsonLd />
      <SoftwareApplicationJsonLd />
      <FAQJsonLd faqs={faqs} />
      <HowToJsonLd />

      <main className="min-h-screen bg-background font-sans text-foreground">
        <LandingNav />

        <LandingHero />

        {/* How It Works — dark inverted */}
        <section
          id="how-it-works"
          className="scroll-mt-20 bg-foreground py-16 text-background md:py-20"
        >
          <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
            <div className="mx-auto max-w-[720px] text-center">
              <p className="font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-secondary">
                Custom Lotería sets · Made from your photos
              </p>
              <h2 className="mt-4 font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-background">
                Three simple steps.
                <br />
                Get a custom Lotería set in minutes.
              </h2>
              <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-relaxed text-background/70">
                Upload your favorite photos and we handle the rest.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:mt-14 md:grid-cols-3">
              <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-9">
                <div className="font-display text-[88px] font-bold leading-none tracking-[-0.04em] text-primary">
                  01
                </div>
                <h3 className="mt-5 font-display text-[22px] font-bold text-background">
                  Upload your photos
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-background/70">
                  Upload photos of family, friends, or pets. We can illustrate anything or anyone
                  you want to feature on a card.
                </p>
                <div className="mt-7 grid h-[260px] flex-none place-items-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.04]">
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
              </article>

              <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-9">
                <div className="font-display text-[88px] font-bold leading-none tracking-[-0.04em] text-primary">
                  02
                </div>
                <h3 className="mt-5 font-display text-[22px] font-bold text-background">
                  AI illustrates each card
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-background/70">
                  Our model draws each photo in classic Lotería style with authentic Spanish labels
                  — El Abuelo, La Novia, El Niño.
                </p>
                <div className="relative mt-7 grid h-[260px] flex-none place-items-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="relative w-[84px] flex-none overflow-hidden rounded-md border-[3px] border-white/40 shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
                      <div className="relative aspect-[2/3]">
                        <Image
                          src={grandpaPhoto}
                          alt="Original photo of a grandfather"
                          fill
                          sizes="84px"
                          className="object-cover"
                        />
                      </div>
                    </div>
                    <span className="whitespace-nowrap font-jetbrains text-[10px] tracking-[0.2em] text-secondary">
                      →&nbsp;AI&nbsp;→
                    </span>
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
              </article>

              <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-9">
                <div className="font-display text-[88px] font-bold leading-none tracking-[-0.04em] text-primary">
                  03
                </div>
                <h3 className="mt-5 font-display text-[22px] font-bold text-background">
                  Print at home
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-background/70">
                  Download print-ready PDFs of every card and tabla. Print on letter or A4 paper at
                  home or your local print shop.
                </p>
                <div className="mt-7 grid h-[260px] flex-none place-items-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.04]">
                  <div className="relative h-full w-[200px]">
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
              </article>
            </div>

            <div className="mt-14 text-center">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="h-auto rounded-full bg-primary px-9 py-[18px] text-[16px] font-semibold text-primary-foreground shadow-[0_8px_18px_-10px_rgba(230,57,70,0.7)] hover:-translate-y-[1px] hover:shadow-[0_12px_22px_-10px_rgba(230,57,70,0.8)]"
                >
                  Start creating free →
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Occasions */}
        <section id="occasions" className="scroll-mt-20 py-16 md:py-20">
          <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
            <p className="text-center font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-primary">
              Made for the moments that matter
            </p>
            <h2 className="mt-4 text-center font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
              Make your next family gathering
              <br />
              even more memorable.
            </h2>
            <p className="mx-auto mt-4 max-w-[580px] text-center text-[17px] leading-relaxed text-muted-foreground">
              Surprise your friends and family with a custom Lotería set they&rsquo;ll love.
            </p>

            <div className="mt-12 grid gap-6 md:mt-14 sm:grid-cols-2 lg:grid-cols-4">
              {occasions.map((item) => {
                const front = cardById(item.front);
                const back = cardById(item.back);
                return (
                  <article
                    key={item.tag}
                    className="group relative overflow-hidden rounded-[22px] border border-[var(--color-rule-warm)] bg-[var(--color-cream-deep)] p-7 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_24px_40px_-28px_rgba(26,26,46,0.35)]"
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

        {/* Showcase */}
        <section className="border-y border-[var(--color-rule-warm)] bg-[var(--color-cream-deep)] py-16 md:py-20">
          <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
            <div>
              <p className="font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-primary">
                Real outputs · Real people
              </p>
              <h2 className="mt-4 max-w-[560px] font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
                54 cards in the deck.
                <br />
                Every one custom.
              </h2>
            </div>

            {/* Mobile: fanned stack of 4 sample cards */}
            <div
              className="mt-16 flex justify-center sm:hidden"
              style={{ perspective: '1000px' }}
              aria-hidden="true"
            >
              {[0, 6, 10, 14].map((idx, i) => {
                const card = heroCards[idx];
                if (!card) return null;
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

            {/* sm+ : full 16-card grid */}
            <div className="mt-16 hidden gap-4 sm:grid sm:grid-cols-4 md:gap-5 xl:grid-cols-8">
              {heroCards.slice(0, 16).map((card, i) => (
                <div
                  key={card.id}
                  className="flex justify-center"
                  style={{ transform: `rotate(${showcaseTilts[i] ?? 0}deg)` }}
                >
                  <HeroCard card={card} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 py-16 md:py-20">
          <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
            <p className="text-center font-jetbrains text-[12px] font-medium uppercase tracking-[0.18em] text-primary">
              Pay once · No subscriptions
            </p>
            <h2 className="mt-4 text-center font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
              Simple pricing.
            </h2>
            <p className="mx-auto mt-4 max-w-[540px] text-center text-[17px] leading-relaxed text-muted-foreground">
              Start free with a sample set. Unlock the full 54-card deck when you&rsquo;re ready.
            </p>

            <div className="mx-auto mt-16 grid max-w-[940px] gap-6 md:mt-20 md:grid-cols-2">
              {/* Free Tier */}
              <article className="relative rounded-[22px] border border-[var(--color-rule-warm)] bg-white p-9 sm:p-10">
                <h3 className="font-display text-[20px] font-bold text-foreground">Free Preview</h3>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-[64px] font-bold leading-none tracking-[-0.03em] text-foreground">
                    $0
                  </span>
                  <span className="text-sm text-muted-foreground">/ forever</span>
                </div>
                <ul className="my-7 space-y-3">
                  {[
                    'Up to 4 custom cards',
                    '1 printable tabla',
                    'AI-generated illustrations',
                    'Spanish label generation',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14.5px] text-foreground">
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
                    className="h-auto w-full rounded-full border-[1.5px] border-foreground bg-transparent py-4 text-[15px] font-semibold text-foreground hover:bg-foreground hover:text-background"
                  >
                    Start free
                  </Button>
                </Link>
              </article>

              {/* Unlocked */}
              <article className="relative -translate-y-2 rounded-[22px] border-2 border-foreground bg-primary p-9 text-white sm:p-10">
                <span className="absolute -top-3.5 right-6 inline-block rounded-full border-2 border-foreground bg-secondary px-3 py-1.5 font-jetbrains text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">
                  Most popular
                </span>
                <h3 className="font-display text-[20px] font-bold text-white">Unlocked Set</h3>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-[64px] font-bold leading-none tracking-[-0.03em] text-white">
                    $5
                  </span>
                  <span className="text-sm text-white/70">one-time</span>
                </div>
                <ul className="my-7 space-y-3">
                  {[
                    'Full 54-card custom deck',
                    'Unlimited printable tablas',
                    'High-resolution print PDFs',
                    'No watermarks · personal use',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14.5px] text-white">
                      <span aria-hidden="true" className="mt-0.5 font-bold text-secondary">
                        ✓
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="block">
                  <Button className="h-auto w-full rounded-full bg-secondary py-4 text-[15px] font-semibold text-foreground shadow-none hover:bg-white hover:text-foreground">
                    Get unlocked set
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
              FAQ
            </p>
            <h2 className="mt-4 text-center font-display text-[clamp(36px,4.4vw,64px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
              Frequently Asked Questions
            </h2>
            <LandingFaq faqs={faqs} />
          </div>
        </section>

        {/* Final CTA */}
        <section id="cta" className="bg-primary py-16 text-center text-white md:py-20">
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

        {/* Footer */}
        <footer className="border-t border-[var(--color-rule-warm)] py-14">
          <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-2.5">
                <Image src="/loteria-star.png" alt="" width={32} height={32} className="h-8 w-8" />
                <span className="font-display text-[19px] font-bold tracking-tight text-foreground">
                  Lotería Generator
                </span>
              </div>
              <div className="flex flex-wrap gap-6">
                <Link
                  href="/sign-up"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Get started
                </Link>
                <Link
                  href="/sign-in"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </Link>
                <Link href="#faq" className="text-sm text-muted-foreground hover:text-foreground">
                  FAQ
                </Link>
                <Link
                  href="#pricing"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Pricing
                </Link>
              </div>
              <p className="font-jetbrains text-[12px] tracking-wider text-muted-foreground">
                © {new Date().getFullYear()} — Hecho con cariño
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
