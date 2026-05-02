import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { db, cards } from '@/db';
import { inngest } from '@/lib/inngest/client';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { id: boardId } = await params;

  const errored = await db
    .select({
      id: cards.id,
      userId: cards.userId,
      originalImageUrl: cards.originalImageUrl,
      errorMessage: cards.errorMessage,
    })
    .from(cards)
    .where(
      and(eq(cards.boardId, boardId), eq(cards.status, 'error'), isNotNull(cards.originalImageUrl))
    );

  if (errored.length === 0) {
    return NextResponse.json({ retriedCount: 0, cardIds: [] });
  }

  const ids = errored.map((c) => c.id);

  await db
    .update(cards)
    .set({ status: 'processing', errorMessage: null, updatedAt: new Date() })
    .where(inArray(cards.id, ids));

  try {
    await inngest.send(
      errored.map((c) => ({
        name: 'card/illustration.regenerate' as const,
        data: {
          cardId: c.id,
          boardId,
          userId: c.userId,
          originalImageUrl: c.originalImageUrl!,
        },
      }))
    );
  } catch (err) {
    // Roll each card back individually so we restore its original errorMessage.
    for (const c of errored) {
      await db
        .update(cards)
        .set({ status: 'error', errorMessage: c.errorMessage, updatedAt: new Date() })
        .where(eq(cards.id, c.id));
    }
    return NextResponse.json(
      { error: 'Failed to enqueue retries', detail: (err as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({ retriedCount: ids.length, cardIds: ids });
}
