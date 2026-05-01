import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, boards } from '@/db';
import { eq, and } from 'drizzle-orm';
import { createBoardUnlockCheckout } from '@/lib/stripe';
import { getPostHogClient } from '@/lib/posthog-server';

/**
 * POST /api/stripe/checkout - Create a checkout session for board unlock
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { boardId } = body;

    if (!boardId) {
      return NextResponse.json({ error: 'Board ID required' }, { status: 400 });
    }

    // Verify the user owns this board
    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    if (board.isUnlocked) {
      return NextResponse.json({ error: 'Board is already unlocked' }, { status: 400 });
    }

    // Get the base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create Stripe checkout session
    const checkoutSession = await createBoardUnlockCheckout({
      boardId: board.id,
      userId: session.user.id,
      userEmail: session.user.email,
      boardName: board.name,
      successUrl: `${baseUrl}/boards/${boardId}?payment=success`,
      cancelUrl: `${baseUrl}/boards/${boardId}?payment=cancelled`,
    });

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: session.user.id,
      event: 'checkout_session_created',
      properties: {
        board_id: board.id,
        board_name: board.name,
        $set: { email: session.user.email, name: session.user.name },
      },
    });
    await posthog.shutdown();

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
