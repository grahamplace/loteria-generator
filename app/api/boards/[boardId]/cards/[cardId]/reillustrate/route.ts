import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db, boards, cards } from '@/db';
import { isAdminEmail } from '@/lib/admin';
import {
  CardReillustrateError,
  REILLUSTRATE_NOTES_MAX,
  reillustrateCard,
} from '@/lib/cards/reillustrate';

const body = z.object({ notes: z.string().max(REILLUSTRATE_NOTES_MAX) });

const STATUS: Record<CardReillustrateError['code'], number> = {
  NO_PHOTO: 400,
  GENERATION_LIMIT_REACHED: 403,
  BUSY: 409,
  CONFLICT: 409,
  QUEUE_FAILED: 503,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; cardId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid notes' }, { status: 400 });
    const { boardId, cardId } = await params;
    const board = await db.query.boards.findFirst({
      where: and(
        eq(boards.id, boardId),
        eq(boards.userId, session.user.id),
        isNull(boards.deletedAt)
      ),
    });
    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    const card = await db.query.cards.findFirst({
      where: and(
        eq(cards.id, cardId),
        eq(cards.boardId, boardId),
        eq(cards.userId, session.user.id)
      ),
    });
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    const updated = await reillustrateCard(card, board, parsed.data.notes.trim() || null, {
      isAdmin: isAdminEmail(session.user.email),
    });
    return NextResponse.json({ card: updated });
  } catch (error) {
    if (error instanceof CardReillustrateError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: STATUS[error.code] }
      );
    }
    console.error('Error re-illustrating card:', error);
    return NextResponse.json({ error: 'Failed to re-illustrate card' }, { status: 500 });
  }
}
