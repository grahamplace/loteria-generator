import { db, user, userProfiles } from '@/db';
import { and, gte, lt, eq, sql } from 'drizzle-orm';

const HOUR_MS = 60 * 60 * 1000;

export function getEmptyBoardNudgeWindow(now: Date): { gte: Date; lt: Date } {
  return {
    gte: new Date(now.getTime() - 48 * HOUR_MS),
    lt: new Date(now.getTime() - 24 * HOUR_MS),
  };
}

export type EmptyBoardNudgeRecipient = {
  id: string;
  email: string;
  name: string;
  locale: string | null;
  boardId: string | null;
};

/**
 * Users who: signed up 24–48h ago, have ≥1 board, have made zero non-default
 * cards, and were never sent the empty-board nudge.
 *
 * Any non-default card counts, whatever its status — someone whose upload failed
 * has tried the product and needs a different message than "don't forget to try".
 * That also makes this set disjoint from `findSignupNudgeRecipients`, which
 * requires >0 completed cards, so a user can only ever land in one of the two.
 */
export async function findEmptyBoardNudgeRecipients(
  now: Date,
  limit = 100
): Promise<EmptyBoardNudgeRecipient[]> {
  const { gte: gteDate, lt: ltDate } = getEmptyBoardNudgeWindow(now);

  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      locale: userProfiles.locale,
      boardId: sql<
        string | null
      >`(select id::text from boards where boards.user_id = "user"."id" order by created_at desc limit 1)`.as(
        'board_id'
      ),
    })
    .from(user)
    .leftJoin(userProfiles, eq(userProfiles.id, user.id))
    .where(
      and(
        gte(user.createdAt, gteDate),
        lt(user.createdAt, ltDate),
        sql`(select count(*) from boards where boards.user_id = "user"."id") > 0`,
        sql`(select count(*) from cards where cards.user_id = "user"."id" and cards.is_default = false) = 0`,
        sql`not exists (select 1 from lifecycle_emails le where le.user_id = "user"."id" and le.type = 'empty_board_nudge')`
      )
    )
    .limit(limit);

  return rows;
}
