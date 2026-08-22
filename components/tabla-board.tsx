import Image from 'next/image';
import type { HeroCard as HeroCardData } from '@/lib/hero-cards';

export function TablaBoard({ cards, width = 165 }: { cards: HeroCardData[]; width?: number }) {
  return (
    <div
      className="grid grid-cols-4 gap-1 rounded-md border-2 border-foreground/80 bg-[#f5f0e1] p-1.5 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.45)]"
      style={{ width }}
    >
      {cards.map((card) => (
        <TablaCell key={card.id} card={card} />
      ))}
    </div>
  );
}

function TablaCell({ card }: { card: HeroCardData }) {
  return (
    <div className="relative flex aspect-[5/7] flex-col overflow-hidden rounded-[2px] border border-foreground/80 bg-[#f5f0e1]">
      <span
        className="absolute left-[2px] top-[1px] z-10 text-[5px] font-bold italic leading-none text-primary"
        style={{ fontFamily: 'ui-serif, Georgia, serif' }}
      >
        {card.number}
      </span>
      <span
        className="absolute right-[2px] top-[1px] z-10 text-[5px] font-bold italic leading-none text-primary"
        style={{ fontFamily: 'ui-serif, Georgia, serif' }}
      >
        {card.number}
      </span>
      <div className="relative flex-1 overflow-hidden">
        <Image
          src={card.image}
          alt=""
          fill
          sizes="40px"
          // 40px decorative thumbnails — 16 per board, three boards stacked in
          // the hero. Indistinguishable from q75 at this size.
          quality={50}
          placeholder="blur"
          className="object-cover"
        />
      </div>
      <div
        className="truncate bg-[#f5f0e1] px-[1px] text-center text-[6px] italic leading-[1] text-foreground/90"
        style={{ fontFamily: 'var(--font-caveat), ui-serif, Georgia, serif' }}
      >
        {card.label}
      </div>
    </div>
  );
}
