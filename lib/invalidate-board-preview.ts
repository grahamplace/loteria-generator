import { db, boards } from '@/db';
import { eq } from 'drizzle-orm';
import { deleteBoardPreview } from '@/lib/blob';

/**
 * Clears the cached board preview so it gets regenerated on next request.
 * Call this whenever a card is added, removed, reordered, or has its illustration updated.
 */
export async function invalidateBoardPreview(boardId: string, userId: string) {
  try {
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      columns: { previewUrl: true },
    });

    if (board?.previewUrl) {
      await deleteBoardPreview(userId, boardId);
    }

    await db.update(boards).set({ previewUrl: null }).where(eq(boards.id, boardId));
  } catch (e) {
    console.error('Failed to invalidate board preview:', e);
  }
}
