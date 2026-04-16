import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import { db, boards } from '@/db';
import { eq, and } from 'drizzle-orm';
import Stripe from 'stripe';

/**
 * POST /api/stripe/webhook - Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(payload, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'payment_intent.succeeded': {
        // Payment confirmed - board should already be unlocked from checkout.session.completed
        console.log('Payment intent succeeded:', event.data.object.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error('Payment failed:', paymentIntent.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

/**
 * Handle successful checkout - unlock the board
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const { boardId, userId } = session.metadata || {};

  if (!boardId || !userId) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  // Verify payment status
  if (session.payment_status !== 'paid') {
    console.log('Payment not yet completed for session:', session.id);
    return;
  }

  // Unlock the board
  await db
    .update(boards)
    .set({
      isUnlocked: true,
      stripePaymentId: session.payment_intent as string,
      unlockedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)));

  console.log(`Board ${boardId} unlocked for user ${userId}`);
}
