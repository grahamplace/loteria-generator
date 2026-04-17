import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';
import { db, cards, boards } from '@/db';
import { eq } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || !isAdminEmail(session.user.email)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { cardId } = await params;

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

  await inngest.send({
    name: 'card/illustration.regenerate',
    data: {
      cardId: card.id,
      boardId: card.boardId,
      userId: card.userId,
      originalImageUrl: card.originalImageUrl,
    },
  });

  return NextResponse.json({ success: true });
}
