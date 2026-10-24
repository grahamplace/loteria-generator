import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin';
import { db, cards } from '@/db';
import { eq } from 'drizzle-orm';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';

/**
 * POST /api/admin/cards/[cardId]/use-original
 *
 * Admin-only: show the uploaded photo as the card instead of its AI drawing,
 * the same state an upload with skipIllustration produces. cropData is kept:
 * it is stored in original-photo coordinates, so the proxies' serve-time crop
 * (preserveOriginal && cropData) applies it correctly.
 */
export async function POST(
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
      return new NextResponse('Not found', { status: 404 });
    }
    if (card.isDefault || !card.originalImageUrl) {
      return NextResponse.json({ error: 'Card has no uploaded photo to use' }, { status: 400 });
    }

    const [updatedCard] = await db
      .update(cards)
      .set({
        illustrationUrl: card.originalImageUrl,
        status: 'completed',
        errorMessage: null,
        preserveOriginal: true,
        updatedAt: new Date(),
      })
      .where(eq(cards.id, card.id))
      .returning();

    await invalidateBoardPreview(card.boardId, card.userId);

    return NextResponse.json({ card: updatedCard });
  } catch (error) {
    console.error('Error switching card to original photo:', error);
    return NextResponse.json({ error: 'Failed to use original photo' }, { status: 500 });
  }
}
