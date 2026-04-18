'use client';

import { Upload, Unlock, Check } from 'lucide-react';

interface BoardWelcomeProps {
  onStartFreePreview: () => void;
  onUnlock: () => void;
}

export function BoardWelcome({ onStartFreePreview, onUnlock }: BoardWelcomeProps) {
  const previewCards = [
    { hue: 18, glyph: '\u{1F339}', label: 'La Rosa', number: 1 },
    { hue: 85, glyph: '\u2600\uFE0F', label: 'El Sol', number: 2 },
    { hue: 195, glyph: '\u2764\uFE0F', label: 'El Coraz\u00F3n', number: 3 },
  ];

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10">
      <div className="text-center max-w-xl">
        {/* Free preview stamp */}
        <div
          className="inline-block px-3 py-1 border-2 border-primary text-primary rounded-md font-mono text-[10px] uppercase tracking-[0.18em] mb-6"
          style={{ transform: 'rotate(-3deg)' }}
        >
          Free preview
        </div>

        {/* Fanned card preview */}
        <div className="relative mb-8 flex items-center justify-center">
          {previewCards.map((card, i) => (
            <div
              key={i}
              className="bg-background border-2 border-black/80 mx-[-14px] shadow-md"
              style={{
                width: 130,
                transform: `rotate(${(i - 1) * 7}deg)`,
                borderRadius: '2px',
              }}
            >
              <div
                className="aspect-[2/3] relative overflow-hidden"
                style={{
                  background: `linear-gradient(160deg, oklch(0.78 0.12 ${card.hue}), oklch(0.55 0.15 ${card.hue}))`,
                }}
              >
                <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-caveat font-bold text-sm">
                  {card.number}
                </div>
                <div
                  className="absolute inset-0 flex items-center justify-center text-4xl"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
                >
                  {card.glyph}
                </div>
              </div>
              <div className="p-2 text-center text-[11px] font-semibold uppercase tracking-wide">
                {card.label}
              </div>
            </div>
          ))}
        </div>

        <h1 className="text-4xl font-bold leading-tight">
          Make a Loter&iacute;a set{' '}
          <span className="font-caveat text-primary text-5xl">from your photos</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
          Start free with 16 cards and 1 export. Unlock for $5 to fill all 54 cards and export
          unlimited printable boards.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={onStartFreePreview}
            className="px-5 py-3 rounded-lg bg-white border border-border text-sm font-semibold flex items-center gap-2 hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Upload className="w-4 h-4" />
            Start with free preview
          </button>
          <button
            onClick={onUnlock}
            className="px-5 py-3 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-2 shadow-sm hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Unlock className="w-4 h-4" />
            Unlock full board &mdash; $5
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            One-time
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            Per board
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            No subscription
          </span>
        </div>
      </div>
    </div>
  );
}
