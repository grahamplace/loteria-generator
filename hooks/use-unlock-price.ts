'use client';

import { useLocale } from 'next-intl';
import { unlockPriceDisplay } from '@/lib/constants';

/** The unlock price formatted for the current locale (see `unlockPriceDisplay`). */
export function useUnlockPriceDisplay(): string {
  return unlockPriceDisplay(useLocale());
}
