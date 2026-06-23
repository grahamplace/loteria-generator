import Stripe from 'stripe';
import { BOARD_UNLOCK_PRICE_CENTS } from '@/lib/constants';

// Server-side Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

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
