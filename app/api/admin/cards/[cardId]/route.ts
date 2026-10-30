import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getAdminSession } from '@/lib/admin';
import { db, cards } from '@/db';
import { deleteCardAndRenumber } from '@/lib/boards/delete-card';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';

/**
 * DELETE /api/admin/cards/[cardId]
 *
 * Admin-only: delete any user's card, the same way the owner's delete does
 * (blobs removed, later cards renumbered, board preview cleared).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    if (!(await getAdminSession())) {
      return new NextResponse('Not found', { status: 404 });
    }

    const { cardId } = await params;
    const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    await deleteCardAndRenumber(card.boardId, card.id, card.userId, { isDefault: card.isDefault });
    await invalidateBoardPreview(card.boardId, card.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting card (admin):', error);
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 });
  }
}
