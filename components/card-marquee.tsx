import type { HeroCard as HeroCardData } from '@/lib/hero-cards';
import { HeroCard } from './hero-card';
import { useTranslations } from 'next-intl';

// Deterministic pseudo-random tilt in [-4, 4] degrees from a seed.
function tiltFor(seed: number) {
  return ((seed * 13 + 7) % 9) - 4;
}

export function CardMarquee({ cards }: { cards: HeroCardData[] }) {
  const t = useTranslations('CardMarquee');

  // Cards in numerical order (1 → 18). With leftward scroll, card 1 begins at
  // the right edge and successive cards appear from the right.
  const row = cards;

  return (
    <div role="region" aria-label={t('ariaLabel')} className="hero-marquee relative mt-2">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[60px]"
        style={{
          background: 'linear-gradient(90deg, var(--background) 0%, transparent 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[60px]"
        style={{
          background: 'linear-gradient(270deg, var(--background) 0%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      <div className="hero-marquee-row hero-marquee-row--left py-3.5">
        {row.map((card, i) => (
          <HeroCard key={`row-${card.id}`} card={card} tilt={tiltFor(i)} />
        ))}
        {row.map((card, i) => (
          <HeroCard key={`row-dup-${card.id}`} card={card} duplicate tilt={tiltFor(i)} />
        ))}
      </div>
    </div>
  );
}
