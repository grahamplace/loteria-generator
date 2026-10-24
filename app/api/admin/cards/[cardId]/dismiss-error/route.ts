import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getAdminSession } from '@/lib/admin';
import { db, cards } from '@/db';

// false un-dismisses, so the overview toast can offer Undo.
const bodySchema = z.object({
  dismissed: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  if (!(await getAdminSession())) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { cardId } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Leaves updatedAt alone: dismissing is admin bookkeeping, not a change to the card.
  const updated = await db
    .update(cards)
    .set({ errorDismissedAt: parsed.data.dismissed ? new Date() : null })
    .where(eq(cards.id, cardId))
    .returning({ errorDismissedAt: cards.errorDismissedAt });

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}
