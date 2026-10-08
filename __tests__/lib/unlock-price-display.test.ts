import { describe, it, expect } from 'vitest';
import { BOARD_UNLOCK_PRICE_DISPLAY, unlockPriceDisplay } from '@/lib/constants';

describe('unlockPriceDisplay', () => {
  it('shows the plain price in English', () => {
    expect(unlockPriceDisplay('en')).toBe(BOARD_UNLOCK_PRICE_DISPLAY);
  });

  it('prefixes US for es-MX so it does not read as pesos', () => {
    expect(unlockPriceDisplay('es-MX')).toBe(`US${BOARD_UNLOCK_PRICE_DISPLAY}`);
  });
});
