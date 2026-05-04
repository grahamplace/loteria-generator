import type Stripe from 'stripe';

export interface BuildEventOpts {
  boardId: string;
  userId: string;
  sessionId?: string;
}

export function buildCheckoutCompletedEvent(opts: BuildEventOpts): Stripe.Event {
  const sessionId = opts.sessionId ?? `cs_test_${Date.now()}`;
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-06-20',
    created: now,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: `pi_test_${Date.now()}`,
        amount_total: 500,
        currency: 'usd',
        metadata: {
          boardId: opts.boardId,
          userId: opts.userId,
        },
      } as unknown as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}
