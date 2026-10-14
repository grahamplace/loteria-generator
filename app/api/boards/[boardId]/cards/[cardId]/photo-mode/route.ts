import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db, cards } from '@/db';
import { photoModeSchema } from '@/lib/validations';
import { CardPhotoModeError, changeCardPhotoMode } from '@/lib/cards/photo-mode';

const settings = z.object({ photoMode: photoModeSchema });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; cardId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = settings.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid photo mode' }, { status: 400 });
    const { boardId, cardId } = await params;
    const card = await db.query.cards.findFirst({
      where: and(
        eq(cards.id, cardId),
        eq(cards.boardId, boardId),
        eq(cards.userId, session.user.id)
      ),
    });
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    return NextResponse.json({ card: await changeCardPhotoMode(card, parsed.data.photoMode) });
  } catch (error) {
    if (error instanceof CardPhotoModeError) {
      const status = error.code === 'NO_PHOTO' ? 400 : error.code === 'QUEUE_FAILED' ? 503 : 409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('Error changing card photo mode:', error);
    return NextResponse.json({ error: 'Failed to change photo mode' }, { status: 500 });
  }
}
