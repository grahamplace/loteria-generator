'use client';

import { Unlock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUnlockPriceDisplay } from '@/hooks/use-unlock-price';

/**
 * Shown on a locked board when an uploaded photo held more cards than the
 * free tier could import. Unlocking, then re-uploading, imports the full set.
 */
export function SheetUnlockBanner({
  foundCount,
  onUnlock,
}: {
  foundCount: number;
  onUnlock: () => void;
}) {
  const t = useTranslations('BoardEditor.SheetSplit');
  const tPage = useTranslations('BoardEditor.Page');
  const unlockPrice = useUnlockPriceDisplay();

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-secondary/40 bg-secondary/15 px-4 py-3"
    >
      <p className="min-w-0 flex-1 basis-60 text-sm text-foreground text-pretty">
        {t('banner', { count: foundCount })}
      </p>
      <button
        type="button"
        onClick={onUnlock}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 touch-manipulation"
      >
        <Unlock className="h-4 w-4" aria-hidden="true" />
        {tPage('unlockButtonPrefix')} {tPage('unlockButtonShort', { price: unlockPrice })}
      </button>
    </div>
  );
}
