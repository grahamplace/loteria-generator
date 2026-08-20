import Image from 'next/image';
import type { HeroCard as HeroCardData } from '@/lib/hero-cards';

export function HeroCard({
  card,
  duplicate = false,
  tilt,
  eager = false,
}: {
  card: HeroCardData;
  duplicate?: boolean;
  tilt?: number;
  /**
   * Opt the illustration out of lazy loading. Set on the above-the-fold hero
   * fan only — which of those images is the LCP element depends on viewport
   * (the photo fan and tabla stack are breakpoint-gated), so the docs favour
   * `loading="eager"` here over a `preload` <link> that could back the wrong
   * candidate.
   */
  eager?: boolean;
}) {
  return (
    <div
      className="relative flex-none w-[120px] rounded-md border-[3px] border-primary bg-[#f5f0e1] p-2 pt-3 shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-transform duration-300"
      style={tilt !== undefined ? { transform: `rotate(${tilt}deg)` } : undefined}
      aria-hidden={duplicate ? 'true' : undefined}
    >
      <span
        className="absolute left-1.5 top-1 text-[11px] font-extrabold italic text-primary"
        style={{ fontFamily: 'ui-serif, Georgia, serif' }}
      >
        {card.number}
      </span>
      <span
        className="absolute right-1.5 top-1 text-[11px] font-extrabold italic text-primary"
        style={{ fontFamily: 'ui-serif, Georgia, serif' }}
      >
        {card.number}
      </span>
      <div className="relative mt-3 aspect-[2/3] overflow-hidden rounded-sm">
        <Image
          src={card.image}
          alt={duplicate ? '' : card.label}
          fill
          sizes="120px"
          placeholder="blur"
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          className="object-cover"
        />
      </div>
      <div
        className="mt-1.5 text-center text-[16px] italic text-foreground"
        style={{ fontFamily: 'var(--font-caveat), ui-serif, Georgia, serif' }}
      >
        {card.label}
      </div>
    </div>
  );
}
