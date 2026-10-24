import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { db, boards, boardExports } from '@/db';

const bodySchema = z.object({
  boardCount: z.number().int().min(0).max(10_000).optional(),
  cardCount: z.number().int().min(0).max(10_000).optional(),
});

/**
 * POST /api/boards/[boardId]/exports - Record a completed PDF export.
 *
 * The PDF renders in the browser, so this is the only server-side trace of an
 * export. The owner's exports count as 'user'; the admin exporting someone
 * else's board from the admin portal is recorded as 'admin' and left out of
 * customer metrics.
 */
export async function POST(req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const board = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      columns: { id: true, userId: true, isUnlocked: true },
    });

    const isAdmin = isAdminEmail(session.user.email);
    if (!board || (board.userId !== session.user.id && !isAdmin)) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    await db.insert(boardExports).values({
      boardId: board.id,
      userId: board.userId,
      source: isAdmin ? 'admin' : 'user',
      boardCount: parsed.data.boardCount ?? null,
      cardCount: parsed.data.cardCount ?? null,
      wasUnlocked: board.isUnlocked,
    });

    return NextResponse.json({ recorded: true }, { status: 201 });
  } catch (error) {
    console.error('Error recording export:', error);
    return NextResponse.json({ error: 'Failed to record export' }, { status: 500 });
  }
}
