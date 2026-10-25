import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getAdminSession } from '@/lib/admin';
import { db, boards } from '@/db';

/** Undo an owner's soft delete; the board reappears in their board list. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { id } = await params;
  const [restored] = await db
    .update(boards)
    .set({ deletedAt: null })
    .where(eq(boards.id, id))
    .returning({ id: boards.id });
  if (!restored) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  return NextResponse.json({ restored: true });
}
