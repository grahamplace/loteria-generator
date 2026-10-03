import { db, cards } from '@/db';
import { eq, and, inArray, sql } from 'drizzle-orm';

export interface CardPosition {
  id: string;
  number: number;
}

/**
 * Resolve a client-requested card order against the board's actual cards.
 *
 * Tolerant by design: the client may not yet know about a card (e.g. an
 * upload still swapping its temp id) or may still list one that was just
 * deleted. Unknown and duplicate ids are dropped; board cards the request
 * omits keep their existing relative order and go after the requested ones.
 * Every board card ends up with a contiguous number starting at 1.
 */
export function computeCardOrder(
  currentCards: CardPosition[],
  requestedIds: string[]
): CardPosition[] {
  const byNumber = [...currentCards].sort((a, b) => a.number - b.number);
  const known = new Set(byNumber.map((c) => c.id));
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of requestedIds) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  for (const card of byNumber) {
    if (!seen.has(card.id)) ordered.push(card.id);
  }

  return ordered.map((id, index) => ({ id, number: index + 1 }));
}

/**
 * Persist a requested card order for a board. Callers must verify access to
 * the board first. Returns the resolved order and whether anything changed.
 */
export async function reorderBoardCards(
  boardId: string,
  requestedIds: string[]
): Promise<{ order: CardPosition[]; changed: boolean }> {
  const boardCards = await db.query.cards.findMany({
    where: eq(cards.boardId, boardId),
    columns: { id: true, number: true },
  });

  const order = computeCardOrder(boardCards, requestedIds);
  const currentNumber = new Map(boardCards.map((c) => [c.id, c.number]));
  const changed = order.filter((c) => currentNumber.get(c.id) !== c.number);

  if (changed.length === 0) {
    return { order, changed: false };
  }

  // Renumber in a single UPDATE. neon-http has no transaction support, so
  // one statement is what keeps the board from being left half-reordered.
  const numberCase = sql.join(
    changed.map((c) => sql`WHEN ${c.id}::uuid THEN ${c.number}::integer`),
    sql` `
  );
  await db
    .update(cards)
    .set({
      number: sql`CASE ${cards.id} ${numberCase} END`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(cards.boardId, boardId),
        inArray(
          cards.id,
          changed.map((c) => c.id)
        )
      )
    );

  return { order, changed: true };
}
