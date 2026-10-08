import { db, boards, cards, type Card } from '@/db';
import { and, eq, sql } from 'drizzle-orm';
import { FREE_CARD_LIMIT, TOTAL_CARD_COUNT } from '@/lib/constants';

export interface NewCard {
  label: string;
  status: Card['status'];
  preserveOriginal?: boolean;
  cropData?: Card['cropData'];
  illustrationUrl?: string | null;
  isDefault?: boolean;
  defaultCardId?: string | null;
}

/**
 * Neon HTTP batch runs in one READ COMMITTED transaction. The first statement
 * locks the parent; the next gets a fresh snapshot after any concurrent insert
 * commits. All insertion paths use this lock, including bulk classic cards.
 */
export async function insertCardsWithinLimit(boardId: string, userId: string, inputs: NewCard[]) {
  if (inputs.length === 0) return [];
  const payload = JSON.stringify(
    inputs.map((card) => ({
      label: card.label,
      status: card.status,
      preserve_original: card.preserveOriginal ?? false,
      crop_data: card.cropData ?? null,
      illustration_url: card.illustrationUrl ?? null,
      is_default: card.isDefault ?? false,
      default_card_id: card.defaultCardId ?? null,
    }))
  );
  const [, inserted] = await db.batch([
    db
      .select({ id: boards.id })
      .from(boards)
      .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
      .for('update'),
    db
      .insert(cards)
      .select(
        sql`
      SELECT gen_random_uuid(), b.id, b.user_id,
        COALESCE((SELECT MAX(number) FROM cards WHERE board_id = b.id), 0) + entries.ordinality::integer,
        i.label, NULL, NULL, i.illustration_url, i.status, NULL, NULL,
        i.is_default, i.default_card_id, i.preserve_original, i.crop_data, NOW(), NOW()
      FROM boards b
      CROSS JOIN jsonb_array_elements(${payload}::jsonb) WITH ORDINALITY AS entries(value, ordinality)
      CROSS JOIN LATERAL jsonb_to_record(entries.value) AS i(
        label text, status text, preserve_original boolean, crop_data json,
        illustration_url text, is_default boolean, default_card_id text
      )
      WHERE b.id = ${boardId} AND b.user_id = ${userId}
        AND (SELECT COUNT(*) FROM cards WHERE board_id = b.id) + ${inputs.length}
          <= CASE WHEN b.is_unlocked THEN ${TOTAL_CARD_COUNT}::integer ELSE ${FREE_CARD_LIMIT}::integer END
        AND NOT EXISTS (
          SELECT 1 FROM cards c WHERE c.board_id = b.id
            AND c.default_card_id IN (SELECT value->>'default_card_id' FROM jsonb_array_elements(${payload}::jsonb))
        )
    `
      )
      .returning(),
  ]);
  return inserted;
}
