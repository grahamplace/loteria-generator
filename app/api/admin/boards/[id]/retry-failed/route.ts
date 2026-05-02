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
  const erroredById = new Map(errored.map((c) => [c.id, c]));

  const flipped = await db
    .update(cards)
    .set({ status: 'processing', errorMessage: null, updatedAt: new Date() })
    .where(and(inArray(cards.id, ids), eq(cards.status, 'error')))
    .returning({ id: cards.id });

  if (flipped.length === 0) {
    return NextResponse.json({ retriedCount: 0, cardIds: [] });
  }

  const flippedIds = flipped.map((r) => r.id);

  try {
    await inngest.send(
      flippedIds.map((id) => {
        const c = erroredById.get(id)!;
        return {
          name: 'card/illustration.regenerate' as const,
          data: {
            cardId: id,
            boardId,
            userId: c.userId,
            originalImageUrl: c.originalImageUrl!,
          },
        };
      })
    );
  } catch (err) {
    // Roll each flipped card back individually so we restore its original errorMessage.
    for (const id of flippedIds) {
      const c = erroredById.get(id)!;
      await db
        .update(cards)
        .set({ status: 'error', errorMessage: c.errorMessage, updatedAt: new Date() })
        .where(eq(cards.id, id));
    }
    return NextResponse.json(
      { error: 'Failed to enqueue retries', detail: (err as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({ retriedCount: flippedIds.length, cardIds: flippedIds });
}
