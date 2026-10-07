import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin';
import { db, cards, boards } from '@/db';
import { eq } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  if (!(await getAdminSession())) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { cardId } = await params;

  let overlay: string | null = null;
  try {
    const body = (await request.json()) as { promptOverlay?: string };
    overlay = body.promptOverlay?.trim() || null;
  } catch {
    // No/invalid body — treat as no overlay.
  }

  const card = await db.query.cards.findFirst({
    where: eq(cards.id, cardId),
  });

  if (!card || !card.originalImageUrl) {
    return NextResponse.json({ error: 'Card not found or has no original image' }, { status: 404 });
  }

  const board = await db.query.boards.findFirst({
    where: eq(boards.id, card.boardId),
  });

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  await db
    .update(cards)
    .set({ promptOverlay: overlay, updatedAt: new Date() })
    .where(eq(cards.id, card.id));

  await inngest.send({
    name: 'card/illustration.regenerate',
    data: {
      cardId: card.id,
      boardId: card.boardId,
      userId: card.userId,
      originalImageUrl: card.originalImageUrl,
      promptOverlay: overlay ?? undefined,
    },
  });

  return NextResponse.json({ success: true });
}
