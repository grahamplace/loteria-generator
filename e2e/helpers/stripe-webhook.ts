import { stripe } from '@/lib/stripe';
import type { APIRequestContext } from '@playwright/test';
import { buildCheckoutCompletedEvent } from '../fixtures/stripe-checkout-completed';

export interface UnlockOpts {
  boardId: string;
  userId: string;
}

export async function unlockBoardViaWebhook(
  request: APIRequestContext,
  opts: UnlockOpts
): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET required for unlock helper');

  const event = buildCheckoutCompletedEvent({ boardId: opts.boardId, userId: opts.userId });
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });

  const res = await request.post('/api/stripe/webhook', {
    headers: {
      'stripe-signature': signature,
      'content-type': 'application/json',
    },
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`Webhook returned ${res.status()}: ${await res.text()}`);
  }
}
