import { describe, it, expect } from 'vitest';
import type Stripe from 'stripe';
import { paymentFieldsFromSession } from '@/lib/stripe';

function session(overrides: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return {
    amount_total: 2000,
    currency: 'usd',
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

describe('paymentFieldsFromSession', () => {
  it('reads a full-price payment', () => {
    expect(paymentFieldsFromSession(session())).toEqual({
      amountPaidCents: 2000,
      amountDiscountCents: 0,
      currency: 'usd',
      promotionCode: null,
    });
  });

  it('reads the expanded promotion code', () => {
    const fields = paymentFieldsFromSession(
      session({
        amount_total: 1000,
        total_details: {
          amount_discount: 1000,
          breakdown: {
            discounts: [
              {
                amount: 1000,
                discount: {
                  promotion_code: { code: 'WELCOME50' },
                  source: { coupon: 'coupon_abc' },
                },
              },
            ],
          },
        },
      })
    );
    expect(fields).toMatchObject({
      amountPaidCents: 1000,
      amountDiscountCents: 1000,
      promotionCode: 'WELCOME50',
    });
  });

  it('falls back to the coupon when there is no promotion code', () => {
    const fields = paymentFieldsFromSession(
      session({
        total_details: {
          amount_discount: 500,
          breakdown: {
            discounts: [
              {
                amount: 500,
                discount: {
                  promotion_code: null,
                  source: { coupon: { id: 'c1', name: 'Friends' } },
                },
              },
            ],
          },
        },
      })
    );
    expect(fields.promotionCode).toBe('Friends');
  });
});
