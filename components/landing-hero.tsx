import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CardMarquee } from '@/components/card-marquee';
import { HeroCard } from '@/components/hero-card';
import { TablaBoard } from '@/components/tabla-board';
import { heroCards } from '@/lib/hero-cards';

import weddingCouplePhoto from '@/scripts/example-images/source-photos/01-wedding-couple.jpg';
import quinceaneraPhoto from '@/scripts/example-images/source-photos/04-quinceanera.jpg';
import familyPhoto from '@/scripts/example-images/source-photos/07-family-portrait.jpg';
import birthdayCandlesPhoto from '@/scripts/example-images/source-photos/05-birthday-candles.jpg';

const trustItems = ['Ready in minutes', 'Print at home', 'No subscription'];

const fannedCardIds = ['la-boda', 'la-quinceanera', 'la-familia', 'el-cumpleanos'];
const fannedRotations = ['-rotate-[12deg]', '-rotate-[4deg]', 'rotate-[4deg]', 'rotate-[12deg]'];
const fannedOffsets = ['translate-y-0', '-translate-y-3', '-translate-y-3', 'translate-y-0'];

const fannedPhotos = [weddingCouplePhoto, quinceaneraPhoto, familyPhoto, birthdayCandlesPhoto];

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

const stackedBoards = [
  { seed: 11, transform: 'translate(-10px, -4px) rotate(-7deg)', z: 'z-0' },
  { seed: 23, transform: 'translate(10px, 4px) rotate(5deg)', z: 'z-10' },
  { seed: 37, transform: 'rotate(-1.5deg)', z: 'z-20' },
];

export function LandingHero() {
  return (
    <header className="relative overflow-hidden pb-10 pt-6 md:pt-10">
      <div
        className="mb-6 flex items-center justify-center gap-3 sm:gap-6 md:mb-10 md:gap-8"
        aria-hidden="true"
      >
        {/* Source-photo fan (the "before") — hidden on small screens to keep the layout breathable */}
        <div className="hidden sm:flex" style={{ perspective: '1000px' }}>
          {fannedPhotos.map((photo, i) => (
            <div key={i} className={`-mx-3 ${fannedRotations[i]} ${fannedOffsets[i]}`}>
              <div className="relative h-[132px] w-[88px] overflow-hidden rounded-lg border-[1.5px] border-foreground/15 bg-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)]">
                <Image
                  src={photo}
                  alt=""
                  fill
                  sizes="88px"
                  placeholder="blur"
                  className="object-cover"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Arrow between photos and cards */}
        <span
          aria-hidden="true"
          className="hidden font-jetbrains text-[18px] text-primary sm:inline"
        >
          →
        </span>

        {/* Lotería card fan (the "after") */}
        <div
          className="flex"
          style={{ perspective: '1000px', transform: 'scale(0.9)', transformOrigin: 'center' }}
        >
          {fannedCardIds.map((id, i) => {
            const card = heroCards.find((c) => c.id === id);
            if (!card) return null;
            return (
              <div key={card.id} className={`-mx-6 ${fannedRotations[i]} ${fannedOffsets[i]}`}>
                <HeroCard card={card} duplicate />
              </div>
            );
          })}
        </div>

        {/* Arrow between cards and board */}
        <span
          aria-hidden="true"
          className="hidden font-jetbrains text-[18px] text-primary lg:inline"
        >
          →
        </span>

        {/* Stack of 3 generated tablas — each shuffled differently */}
        <div className="relative -ml-3 hidden h-[210px] w-[180px] flex-none lg:block">
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
                <TablaBoard cards={cards} width={150} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-[clamp(34px,4.8vw,60px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
          Turn your photos into
          <br />a custom{' '}
          <span className="relative inline-block">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-[0.05em] -z-0 h-[0.18em] -skew-x-6 bg-secondary"
            />
            <span className="relative">Lotería</span>
          </span>{' '}
          <span className="font-display italic font-medium">set.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[600px] text-[17px] leading-[1.55] text-muted-foreground">
          Upload photos of your{' '}
          <strong className="font-semibold text-foreground">family, friends, even pets</strong>{' '}
          &mdash; we instantly illustrate them in classic Mexican Lotería style and generate a full
          Lotería set you can print and play at home.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3.5">
          <Link href="/sign-up">
            <Button
              size="lg"
              className="h-auto rounded-full px-8 py-[14px] text-[16px] font-semibold shadow-[0_8px_18px_-10px_rgba(230,57,70,0.7)] hover:-translate-y-[1px] hover:shadow-[0_12px_22px_-10px_rgba(230,57,70,0.8)]"
            >
              Try it for free →
            </Button>
          </Link>
          <Link href="#how-it-works">
            <Button
              size="lg"
              variant="outline"
              className="h-auto rounded-full border-[1.5px] border-foreground bg-transparent px-8 py-[14px] text-[16px] font-semibold text-foreground hover:bg-foreground hover:text-background"
            >
              See how it works
            </Button>
          </Link>
        </div>
        <ul className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-2 font-jetbrains text-[12px] tracking-wider text-muted-foreground">
          {trustItems.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 md:mt-14">
        <CardMarquee cards={heroCards} />
      </div>
    </header>
  );
}
