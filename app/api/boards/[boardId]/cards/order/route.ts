import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, boards } from '@/db';
import { eq, and } from 'drizzle-orm';
import { reorderCardsSchema } from '@/lib/validations';
import { reorderBoardCards } from '@/lib/card-order';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';

/**
 * PUT /api/boards/[boardId]/cards/order - Persist a drag-and-drop reorder
 * Body: { cardIds: string[] } in the desired display order
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = await params;
    const body = await request.json();
    const parsed = reorderCardsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify board ownership
    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const { order, changed } = await reorderBoardCards(boardId, parsed.data.cardIds);
    if (changed) {
      await invalidateBoardPreview(boardId, session.user.id);
    }

    return NextResponse.json({ cards: order });
  } catch (error) {
    console.error('Error reordering cards:', error);
    return NextResponse.json({ error: 'Failed to reorder cards' }, { status: 500 });
  }
}
