import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin';
import { db, cards } from '@/db';
import { eq } from 'drizzle-orm';
import { CardPhotoModeError, changeCardPhotoMode } from '@/lib/cards/photo-mode';

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

    const updatedCard = await changeCardPhotoMode(card, 'original');

    return NextResponse.json({ card: updatedCard });
  } catch (error) {
    if (error instanceof CardPhotoModeError)
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'NO_PHOTO' ? 400 : 409 }
      );
    console.error('Error switching card to original photo:', error);
    return NextResponse.json({ error: 'Failed to use original photo' }, { status: 500 });
  }
}
