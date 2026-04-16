import type { HeroCard as HeroCardData } from '@/lib/hero-cards';
import { HeroCard } from './hero-card';
import { HeroCardArtSprite } from './hero-card-art';

export function CardMarquee({ cards }: { cards: HeroCardData[] }) {
  const mid = Math.ceil(cards.length / 2);
  const rowA = cards.slice(0, mid);
  const rowB = cards.slice(mid);

  return (
    <div
      role="region"
      aria-label="Example Lotería cards produced by the generator"
      className="hero-marquee relative mt-2"
    >
      <HeroCardArtSprite />
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
        {rowA.map((card) => (
          <HeroCard key={`a-${card.id}`} card={card} />
        ))}
        {rowA.map((card) => (
          <HeroCard key={`a-dup-${card.id}`} card={card} duplicate />
        ))}
      </div>

      <div
        className="hero-marquee-row hero-marquee-row--right py-3.5"
        style={{ marginLeft: '-60px' }}
      >
        {rowB.map((card) => (
          <HeroCard key={`b-${card.id}`} card={card} />
        ))}
        {rowB.map((card) => (
          <HeroCard key={`b-dup-${card.id}`} card={card} duplicate />
        ))}
      </div>
    </div>
  );
}
