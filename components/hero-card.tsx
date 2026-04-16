import type { HeroCard as HeroCardData, Tone } from '@/lib/hero-cards';
import { CardArt } from './hero-card-art';

const toneGradients: Record<Tone, string> = {
  marigold: 'linear-gradient(135deg, #fde0a4 0%, #f5c263 100%)',
  verde: 'linear-gradient(135deg, #b3d9d6 0%, #7fc2bf 100%)',
  rose: 'linear-gradient(135deg, #e8b4b4 0%, #d48a8a 100%)',
};

export function HeroCard({ card, duplicate = false }: { card: HeroCardData; duplicate?: boolean }) {
  return (
    <div
      className="relative flex-none w-[120px] rounded-md border-[3px] border-primary bg-[#fffdf4] p-2 pt-3 shadow-[0_4px_14px_rgba(0,0,0,0.12)]"
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
      <div
        className="mt-3 flex aspect-square items-center justify-center rounded-sm text-primary"
        style={{
          background: toneGradients[card.tone],
          border: '1px solid rgba(200, 54, 46, 0.25)',
        }}
      >
        <div style={{ width: '60%', height: '60%' }}>
          <CardArt artKey={card.artKey} />
        </div>
      </div>
      <div
        className="mt-1.5 text-center text-[16px] italic text-foreground"
        style={{ fontFamily: 'var(--font-caveat), ui-serif, Georgia, serif' }}
      >
        {card.label}
      </div>
      <div
        className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-md"
        style={{ background: 'linear-gradient(135deg, #d4d4d4, #a8a8a8)' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 22c0-4.5 3.5-8 8-8s8 3.5 8 8" fill="none" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
