import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';
import { db, cards } from '@/db';
import { eq } from 'drizzle-orm';
import { adminCardLabelSchema } from '@/lib/validations';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';

/**
 * PUT /api/admin/cards/[cardId]/label
 *
 * Admin-only: rename any user's card. Body: { label }. The label is printed on
 * the card face, so the owner's cached board preview is invalidated.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !isAdminEmail(session.user.email)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const parsed = adminCardLabelSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { label } = parsed.data;

    const { cardId } = await params;
    const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
    if (!card) {
      return new NextResponse('Not found', { status: 404 });
    }
    if (card.label === label) {
      return NextResponse.json({ card });
    }

    const [updatedCard] = await db
      .update(cards)
      .set({ label, updatedAt: new Date() })
      .where(eq(cards.id, card.id))
      .returning();

    // Preview blobs live under the owner's path, not the admin's.
    await invalidateBoardPreview(card.boardId, card.userId);

    return NextResponse.json({ card: updatedCard });
  } catch (error) {
    console.error('Error updating card label (admin):', error);
    return NextResponse.json({ error: 'Failed to update label' }, { status: 500 });
  }
}
