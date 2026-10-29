import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { handleSafetyEvent, isSafetyEvent } from '@/lib/openai-safety-webhook';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/openai/webhook - OpenAI safety enforcement notices
 */
export async function POST(request: NextRequest) {
  const payload = await request.text();

  try {
    await openai.webhooks.verifySignature(
      payload,
      request.headers,
      process.env.OPENAI_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('OpenAI webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(payload) as { type?: unknown; data?: { id?: string } };
  if (!isSafetyEvent(event.type) || !event.data?.id) {
    return NextResponse.json({ received: true });
  }

  try {
    await handleSafetyEvent(event.type, event.data.id);
  } catch (error) {
    // A non-2xx makes OpenAI redeliver the notice.
    console.error('OpenAI safety webhook failed:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
