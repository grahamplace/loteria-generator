import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getAdminSession } from '@/lib/admin';
import { db, boards } from '@/db';

// null clears the override, falling back to the free/paid default.
const bodySchema = z.object({
  limit: z.number().int().min(0).max(10_000).nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { id: boardId } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
  }

  const updated = await db
    .update(boards)
    .set({ generationLimitOverride: parsed.data.limit, updatedAt: new Date() })
    .where(eq(boards.id, boardId))
    .returning({ generationLimitOverride: boards.generationLimitOverride });

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}
