import Stripe from 'stripe';
import { BOARD_UNLOCK_PRICE_CENTS } from '@/lib/constants';
import { lazyClient, requireEnv } from '@/lib/lazy-client';

// Server-side Stripe client. Constructed on first use, not at module scope —
// the Stripe constructor throws without an API key, which would fail
// `next build` while it collects page data. See lib/lazy-client.ts.
export const stripe = lazyClient(
  () =>
    new Stripe(requireEnv('STRIPE_SECRET_KEY', 'the Stripe client'), {
      typescript: true,
    })
);

/**
 * Create a Stripe checkout session for unlocking a board
 */
export async function createBoardUnlockCheckout(params: {
  boardId: string;
  userId: string;
  userEmail: string;
  boardName: string;
  successUrl: string;
  cancelUrl: string;
  promotionCodeId?: string;
}): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: params.userEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: BOARD_UNLOCK_PRICE_CENTS,
          product_data: {
            name: `Unlock Loteria Board: ${params.boardName}`,
            description:
              'Unlock full features: up to 54 cards, unlimited board generations, and all export options.',
          },
        },
        quantity: 1,
      },
    ],
    // Stripe rejects setting both discounts and allow_promotion_codes.
    ...(params.promotionCodeId
      ? { discounts: [{ promotion_code: params.promotionCodeId }] }
      : { allow_promotion_codes: true }),
    metadata: {
      boardId: params.boardId,
      userId: params.userId,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return session;
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
}

/**
 * Create or retrieve a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(params: {
  userId: string;
  email: string;
  name?: string;
}): Promise<Stripe.Customer> {
  // Search for existing customer by email
  const existingCustomers = await stripe.customers.list({
    email: params.email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // Create new customer
  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      userId: params.userId,
    },
  });
}

export interface BoardPaymentFields {
  amountPaidCents: number | null;
  amountDiscountCents: number | null;
  currency: string | null;
  promotionCode: string | null;
}

// Expand path that makes the promotion code readable on a Checkout Session.
export const SESSION_DISCOUNT_EXPAND = 'total_details.breakdown.discounts.discount.promotion_code';

/**
 * What the customer paid for a board, read off a Checkout Session retrieved
 * with SESSION_DISCOUNT_EXPAND. Falls back to the coupon's name or id when the
 * discount wasn't applied through a promotion code.
 */
export function paymentFieldsFromSession(session: Stripe.Checkout.Session): BoardPaymentFields {
  const discount = session.total_details?.breakdown?.discounts[0]?.discount;
  const promo = discount?.promotion_code;
  const coupon = discount?.source?.coupon;
  const promotionCode =
    (promo && typeof promo !== 'string' ? promo.code : null) ??
    (coupon && typeof coupon !== 'string' ? (coupon.name ?? coupon.id) : (coupon ?? null));

  return {
    amountPaidCents: session.amount_total,
    amountDiscountCents: session.total_details?.amount_discount ?? null,
    currency: session.currency,
    promotionCode,
  };
}

export async function retrieveSessionPaymentFields(sessionId: string): Promise<BoardPaymentFields> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: [SESSION_DISCOUNT_EXPAND],
  });
  return paymentFieldsFromSession(session);
}
