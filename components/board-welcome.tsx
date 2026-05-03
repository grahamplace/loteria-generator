'use client';

import { useRef } from 'react';
import { Upload, Unlock, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BoardWelcomeProps {
  onFilesSelected: (files: File[]) => void;
  onUnlock: () => void;
}

export function BoardWelcome({ onFilesSelected, onUnlock }: BoardWelcomeProps) {
  const t = useTranslations('BoardEditor.Welcome');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
    // Reset so selecting the same file twice still fires onChange
    e.target.value = '';
  }

  const previewCards = [
    { hue: 18, glyph: '\u{1F339}', label: 'La Rosa', number: 1 },
    { hue: 85, glyph: '☀️', label: 'El Sol', number: 2 },
    { hue: 195, glyph: '❤️', label: 'El Corazón', number: 3 },
  ];

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleChange}
        className="hidden"
      />
      <div className="text-center max-w-xl">
        {/* Free preview stamp */}
        <div
          className="inline-block px-3 py-1 border-2 border-primary text-primary rounded-md font-mono text-[10px] uppercase tracking-[0.18em] mb-6"
          style={{ transform: 'rotate(-3deg)' }}
        >
          {t('freePreviewBadge')}
        </div>

        {/* Fanned card preview */}
        <div className="relative mb-7 md:mb-8 flex items-center justify-center">
          {previewCards.map((card, i) => (
            <div
              key={i}
              className="bg-background border-2 border-black/80 mx-[-14px] shadow-md w-[96px] md:w-[130px]"
              style={{
                transform: `rotate(${(i - 1) * 9}deg)`,
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

        <h1 className="text-[28px] md:text-4xl font-bold leading-tight tracking-tight md:tracking-normal px-2 md:px-0">
          {t('headline')}{' '}
          <span className="font-caveat text-primary text-[36px] md:text-5xl leading-none">
            {t('headlineEmphasis')}
          </span>
        </h1>
        <p className="text-[13px] md:text-sm text-muted-foreground mt-3 max-w-[280px] md:max-w-md mx-auto">
          {t('subtitle')}
        </p>

        <div className="mt-6 md:mt-8 w-full md:w-auto flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full md:w-auto h-12 md:h-auto px-5 md:py-3 rounded-xl md:rounded-lg bg-primary md:bg-white text-white md:text-foreground border-0 md:border md:border-border text-[15px] md:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm md:shadow-none md:hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Upload className="w-4 h-4" />
            {t('startFree')}
          </button>
          <button
            onClick={onUnlock}
            className="w-full md:w-auto h-12 md:h-auto px-5 md:py-3 rounded-xl md:rounded-lg bg-white md:bg-primary text-foreground md:text-white border border-border md:border-0 text-[15px] md:text-sm font-semibold flex items-center justify-center gap-2 md:shadow-sm md:hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Unlock className="w-4 h-4" />
            {t('unlockFull')}
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3 md:gap-5 text-[9px] md:text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            {t('trustOneTime')}
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            {t('trustPerBoard')}
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            {t('trustNoSubscription')}
          </span>
        </div>
      </div>
    </div>
  );
}
