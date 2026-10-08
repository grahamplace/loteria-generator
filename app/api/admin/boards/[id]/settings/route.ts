import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, boards } from '@/db';
import { getAdminSession } from '@/lib/admin';
import { updateBoardSchema } from '@/lib/validations';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return new NextResponse('Not found', { status: 404 });
  const { id } = await params;
  const parsed = updateBoardSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 });
  const board = await db.query.boards.findFirst({ where: eq(boards.id, id) });
  if (!board) return new NextResponse('Not found', { status: 404 });
  const [updated] = await db
    .update(boards)
    .set({
      ...parsed.data,
      styleOptions: parsed.data.styleOptions
        ? { ...board.styleOptions, ...parsed.data.styleOptions }
        : board.styleOptions,
      updatedAt: new Date(),
    })
    .where(eq(boards.id, id))
    .returning();
  await invalidateBoardPreview(id, board.userId);
  return NextResponse.json({ board: updated });
}
