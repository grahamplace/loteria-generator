import { db, cards } from '@/db';
import { and, eq, gt, sql } from 'drizzle-orm';
import { deleteCardImages } from '@/lib/blob';

/**
 * Delete a card (and its blobs unless it is a shared default card), then
 * renumber the cards that followed it. Caller verifies ownership.
 */
export async function deleteCardAndRenumber(
  boardId: string,
  cardId: string,
  userId: string,
  opts: { isDefault?: boolean } = {}
): Promise<void> {
  if (!opts.isDefault) {
    try {
      await deleteCardImages(userId, boardId, cardId);
    } catch (blobError) {
      console.error('Error deleting card images:', blobError);
    }
  }

  const card = await db.query.cards.findFirst({
    where: and(eq(cards.id, cardId), eq(cards.boardId, boardId)),
    columns: { number: true },
  });
  if (!card) return;

  await db.delete(cards).where(eq(cards.id, cardId));

  await db
    .update(cards)
    .set({ number: sql`${cards.number} - 1`, updatedAt: new Date() })
    .where(and(eq(cards.boardId, boardId), gt(cards.number, card.number)));
}
