import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin';
import { db, cards } from '@/db';
import { eq } from 'drizzle-orm';
import { adminCardRiddleSchema } from '@/lib/validations';

/**
 * PUT /api/admin/cards/[cardId]/riddle
 *
 * Admin-only: set any user's card riddle. Body: { riddle }; an empty string
 * clears it. Riddles print on the caller sheet, not the card face, so the
 * board preview is left alone.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    if (!(await getAdminSession())) {
      return new NextResponse('Not found', { status: 404 });
    }

    const parsed = adminCardRiddleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const riddle = parsed.data.riddle || null;

    const { cardId } = await params;
    const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
    if (!card) {
      return new NextResponse('Not found', { status: 404 });
    }
    if (card.riddle === riddle) {
      return NextResponse.json({ card });
    }

    const [updatedCard] = await db
      .update(cards)
      .set({ riddle, updatedAt: new Date() })
      .where(eq(cards.id, card.id))
      .returning();

    return NextResponse.json({ card: updatedCard });
  } catch (error) {
    console.error('Error updating card riddle (admin):', error);
    return NextResponse.json({ error: 'Failed to update riddle' }, { status: 500 });
  }
}
