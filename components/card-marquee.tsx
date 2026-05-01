import type { HeroCard as HeroCardData } from '@/lib/hero-cards';
import { HeroCard } from './hero-card';

export function CardMarquee({ cards }: { cards: HeroCardData[] }) {
  // Top row: cards in numerical order (1 → 18). With rightward scroll the
  // last card in DOM order ends up at the visual left edge first, so we render
  // 18 → 1 (reversed) instead.
  const topRow = [...cards].reverse();
  // Bottom row: numerical order. With leftward scroll, card 1 begins at the
  // right edge and successive cards appear from the right.
  const bottomRow = cards;

  return (
    <div
      role="region"
      aria-label="Example Lotería cards produced by the generator"
      className="hero-marquee relative mt-2"
    >
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

      <div className="hero-marquee-row hero-marquee-row--right py-3.5">
        {topRow.map((card) => (
          <HeroCard key={`top-${card.id}`} card={card} />
        ))}
        {topRow.map((card) => (
          <HeroCard key={`top-dup-${card.id}`} card={card} duplicate />
        ))}
      </div>

      <div className="hero-marquee-row hero-marquee-row--left py-3.5">
        {bottomRow.map((card) => (
          <HeroCard key={`bot-${card.id}`} card={card} />
        ))}
        {bottomRow.map((card) => (
          <HeroCard key={`bot-dup-${card.id}`} card={card} duplicate />
        ))}
      </div>
    </div>
  );
}
