import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getAdminSession } from '@/lib/admin';
import { db, boards } from '@/db';
import { reorderCardsSchema } from '@/lib/validations';
import { reorderBoardCards } from '@/lib/card-order';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';

/**
 * PUT /api/admin/boards/[id]/cards/order - Admin reorder of any user's board
 * Body: { cardIds: string[] } in the desired display order
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const { id: boardId } = await params;
    const parsed = reorderCardsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const board = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      columns: { userId: true },
    });
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const { order, changed } = await reorderBoardCards(boardId, parsed.data.cardIds);
    if (changed) {
      // Preview blobs live under the owner's path, not the admin's.
      await invalidateBoardPreview(boardId, board.userId);
    }

    return NextResponse.json({ cards: order });
  } catch (error) {
    console.error('Error reordering cards (admin):', error);
    return NextResponse.json({ error: 'Failed to reorder cards' }, { status: 500 });
  }
}
