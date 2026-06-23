// __tests__/lib/stripe-promotions.test.ts
import { describe, it, expect } from 'vitest';
import { resolvePromotionCode } from '@/lib/stripe-promotions';

function fakeStripe(promo: unknown) {
  return {
    promotionCodes: {
      list: async () => ({ data: promo ? [promo] : [] }),
    },
  } as never;
}

describe('resolvePromotionCode', () => {
  it('returns the id for an active, unexpired, unredeemed code', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const id = await resolvePromotionCode(
      'LOTERIA-AAAAAA',
      fakeStripe({
        id: 'promo_1',
        active: true,
        expires_at: future,
        max_redemptions: 1,
        times_redeemed: 0,
      })
    );
    expect(id).toBe('promo_1');
  });

  it('returns null when no code is found', async () => {
    expect(await resolvePromotionCode('NOPE', fakeStripe(null))).toBeNull();
  });

  it('returns null for an expired code', async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    expect(
      await resolvePromotionCode(
        'X',
        fakeStripe({
          id: 'promo_2',
          active: true,
          expires_at: past,
          max_redemptions: 1,
          times_redeemed: 0,
        })
      )
    ).toBeNull();
  });

  it('returns null when fully redeemed', async () => {
    expect(
      await resolvePromotionCode(
        'X',
        fakeStripe({
          id: 'promo_3',
          active: true,
          expires_at: null,
          max_redemptions: 1,
          times_redeemed: 1,
        })
      )
    ).toBeNull();
  });
});
