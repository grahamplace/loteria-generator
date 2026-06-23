// __tests__/lib/stripe-promotions.test.ts
import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import {
  resolvePromotionCode,
  getOrCreateNudgeCoupon,
  getOrCreateReengagementCoupon,
  createOneTimePromotionCode,
} from '@/lib/stripe-promotions';
import { SIGNUP_NUDGE_COUPON_ID, REENGAGEMENT_COUPON_ID } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Fake Stripe helpers
// ---------------------------------------------------------------------------

function fakeStripe(promo: unknown) {
  return {
    promotionCodes: {
      list: async () => ({ data: promo ? [promo] : [] }),
    },
  } as unknown as Stripe;
}

type FakeMocks = {
  couponsCreate: ReturnType<typeof vi.fn>;
  couponsRetrieve: ReturnType<typeof vi.fn>;
  promotionCodesCreate: ReturnType<typeof vi.fn>;
};

type FakeStripeClient = Stripe & { _mocks: FakeMocks };

/** Build a fake Stripe client for coupon + promotionCodes operations. */
function fakeStripeWithCoupons({
  retrieveResult,
  createCouponResult,
  createPromoResult,
}: {
  retrieveResult?: { id: string } | { code: string };
  createCouponResult?: { id: string };
  createPromoResult?: { id: string };
}): FakeStripeClient {
  const couponsCreate = vi.fn(async () => createCouponResult ?? { id: 'created-coupon' });
  const couponsRetrieve = vi.fn(async () => {
    if (retrieveResult && 'code' in retrieveResult) {
      // Simulate a Stripe error
      throw retrieveResult;
    }
    return retrieveResult ?? { id: 'existing-coupon' };
  });
  const promotionCodesCreate = vi.fn(async () => createPromoResult ?? { id: 'promo_new' });

  const client = {
    coupons: { retrieve: couponsRetrieve, create: couponsCreate },
    promotionCodes: {
      list: async () => ({ data: [] }),
      create: promotionCodesCreate,
    },
    _mocks: { couponsCreate, couponsRetrieve, promotionCodesCreate },
  };
  return client as unknown as FakeStripeClient;
}

// ---------------------------------------------------------------------------
// resolvePromotionCode (existing tests preserved)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// getOrCreateNudgeCoupon
// ---------------------------------------------------------------------------

describe('getOrCreateNudgeCoupon', () => {
  it('returns the existing coupon id when Stripe already has it', async () => {
    const client = fakeStripeWithCoupons({ retrieveResult: { id: SIGNUP_NUDGE_COUPON_ID } });
    const id = await getOrCreateNudgeCoupon(client);
    expect(id).toBe(SIGNUP_NUDGE_COUPON_ID);
    expect(client._mocks.couponsCreate).not.toHaveBeenCalled();
  });

  it('creates the coupon on resource_missing and returns its id', async () => {
    const client = fakeStripeWithCoupons({
      retrieveResult: { code: 'resource_missing' },
      createCouponResult: { id: SIGNUP_NUDGE_COUPON_ID },
    });
    const id = await getOrCreateNudgeCoupon(client);
    expect(id).toBe(SIGNUP_NUDGE_COUPON_ID);
    expect(client._mocks.couponsCreate).toHaveBeenCalledOnce();
  });

  it('re-throws non-resource_missing errors', async () => {
    const client = fakeStripeWithCoupons({ retrieveResult: { code: 'api_error' } });
    await expect(getOrCreateNudgeCoupon(client)).rejects.toMatchObject({ code: 'api_error' });
  });
});

// ---------------------------------------------------------------------------
// getOrCreateReengagementCoupon
// ---------------------------------------------------------------------------

describe('getOrCreateReengagementCoupon', () => {
  it('returns the existing coupon id when Stripe already has it', async () => {
    const client = fakeStripeWithCoupons({ retrieveResult: { id: REENGAGEMENT_COUPON_ID } });
    const id = await getOrCreateReengagementCoupon(client);
    expect(id).toBe(REENGAGEMENT_COUPON_ID);
    expect(client._mocks.couponsCreate).not.toHaveBeenCalled();
  });

  it('creates the coupon on resource_missing and returns its id', async () => {
    const client = fakeStripeWithCoupons({
      retrieveResult: { code: 'resource_missing' },
      createCouponResult: { id: REENGAGEMENT_COUPON_ID },
    });
    const id = await getOrCreateReengagementCoupon(client);
    expect(id).toBe(REENGAGEMENT_COUPON_ID);
    expect(client._mocks.couponsCreate).toHaveBeenCalledOnce();
    expect(client._mocks.couponsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: REENGAGEMENT_COUPON_ID })
    );
  });

  it('re-throws non-resource_missing errors', async () => {
    const client = fakeStripeWithCoupons({ retrieveResult: { code: 'api_error' } });
    await expect(getOrCreateReengagementCoupon(client)).rejects.toMatchObject({
      code: 'api_error',
    });
  });
});

// ---------------------------------------------------------------------------
// createOneTimePromotionCode
// ---------------------------------------------------------------------------

describe('createOneTimePromotionCode', () => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  it('uses the supplied couponId directly, bypassing getOrCreateNudgeCoupon', async () => {
    const client = fakeStripeWithCoupons({ createPromoResult: { id: 'promo_supplied' } });

    const result = await createOneTimePromotionCode(
      { code: 'LOTERIA-TEST01', expiresAt, couponId: 'my-custom-coupon' },
      client
    );

    expect(result.id).toBe('promo_supplied');
    // The supplied couponId should be forwarded — no coupon lookup needed
    expect(client._mocks.couponsRetrieve).not.toHaveBeenCalled();
    expect(client._mocks.couponsCreate).not.toHaveBeenCalled();
    expect(client._mocks.promotionCodesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ promotion: { type: 'coupon', coupon: 'my-custom-coupon' } })
    );
  });

  it('falls back to getOrCreateNudgeCoupon when couponId is omitted (regression)', async () => {
    const client = fakeStripeWithCoupons({
      retrieveResult: { id: SIGNUP_NUDGE_COUPON_ID },
      createPromoResult: { id: 'promo_nudge' },
    });

    const result = await createOneTimePromotionCode({ code: 'LOTERIA-TEST02', expiresAt }, client);

    expect(result.id).toBe('promo_nudge');
    // No couponId supplied → must have resolved via the nudge coupon
    expect(client._mocks.couponsRetrieve).toHaveBeenCalledOnce();
    expect(client._mocks.promotionCodesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ promotion: { type: 'coupon', coupon: SIGNUP_NUDGE_COUPON_ID } })
    );
  });

  it('passes code and expires_at correctly to promotionCodes.create', async () => {
    const client = fakeStripeWithCoupons({
      retrieveResult: { id: SIGNUP_NUDGE_COUPON_ID },
      createPromoResult: { id: 'promo_check' },
    });

    await createOneTimePromotionCode({ code: 'LOTERIA-ABC123', expiresAt }, client);

    expect(client._mocks.promotionCodesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'LOTERIA-ABC123',
        max_redemptions: 1,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      })
    );
  });
});
