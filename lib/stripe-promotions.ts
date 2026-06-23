// lib/stripe-promotions.ts
import type Stripe from 'stripe';
import {
  SIGNUP_NUDGE_COUPON_ID,
  SIGNUP_NUDGE_DISCOUNT_PERCENT,
  REENGAGEMENT_COUPON_ID,
  REENGAGEMENT_DISCOUNT_PERCENT,
} from '@/lib/constants';

function defaultClient(): Stripe {
  // Lazily import so tests that pass their own client never touch the real singleton.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./stripe').stripe as Stripe;
}

/** Idempotently ensure the reusable 25%-off coupon exists; returns its id. */
export async function getOrCreateNudgeCoupon(client: Stripe = defaultClient()): Promise<string> {
  try {
    const coupon = await client.coupons.retrieve(SIGNUP_NUDGE_COUPON_ID);
    return coupon.id;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'resource_missing') {
      const created = await client.coupons.create({
        id: SIGNUP_NUDGE_COUPON_ID,
        percent_off: SIGNUP_NUDGE_DISCOUNT_PERCENT,
        duration: 'once',
        name: `Signup Nudge ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% Off`,
      });
      return created.id;
    }
    throw err;
  }
}

/** Idempotently ensure the reusable 25%-off re-engagement coupon exists; returns its id. */
export async function getOrCreateReengagementCoupon(
  client: Stripe = defaultClient()
): Promise<string> {
  try {
    const coupon = await client.coupons.retrieve(REENGAGEMENT_COUPON_ID);
    return coupon.id;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'resource_missing') {
      const created = await client.coupons.create({
        id: REENGAGEMENT_COUPON_ID,
        percent_off: REENGAGEMENT_DISCOUNT_PERCENT,
        duration: 'once',
        name: `Re-engagement ${REENGAGEMENT_DISCOUNT_PERCENT}% Off`,
      });
      return created.id;
    }
    throw err;
  }
}

/** Create a single-use promotion code that expires at `expiresAt`.
 *  When `couponId` is supplied it is used directly; otherwise the nudge coupon is resolved. */
export async function createOneTimePromotionCode(
  params: { code: string; expiresAt: Date; couponId?: string },
  client: Stripe = defaultClient()
): Promise<Stripe.PromotionCode> {
  const resolvedCouponId = params.couponId ?? (await getOrCreateNudgeCoupon(client));
  return client.promotionCodes.create({
    promotion: { type: 'coupon', coupon: resolvedCouponId },
    code: params.code,
    max_redemptions: 1,
    expires_at: Math.floor(params.expiresAt.getTime() / 1000),
  });
}

/** Resolve a human code string to a usable promotion code id, or null. */
export async function resolvePromotionCode(
  code: string,
  client: Stripe = defaultClient()
): Promise<string | null> {
  const list = await client.promotionCodes.list({ code, active: true, limit: 1 });
  const promo = list.data[0];
  if (!promo || !promo.active) return null;
  if (promo.expires_at && promo.expires_at * 1000 < Date.now()) return null;
  if (promo.max_redemptions != null && promo.times_redeemed >= promo.max_redemptions) return null;
  return promo.id;
}
