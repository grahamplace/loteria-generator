import { db, user, userProfiles } from '@/db';
import { and, gte, lt, eq, sql } from 'drizzle-orm';

const HOUR_MS = 60 * 60 * 1000;

export function getSignupNudgeWindow(now: Date): { gte: Date; lt: Date } {
  return {
    gte: new Date(now.getTime() - 48 * HOUR_MS),
    lt: new Date(now.getTime() - 24 * HOUR_MS),
  };
}

export type SignupNudgeRecipient = {
  id: string;
  email: string;
  name: string;
  locale: string | null;
  boardId: string | null;
};

/**
 * Users who: signed up 24–48h ago, made ≥1 completed non-default card,
 * have 0 unlocked boards, and were never sent the signup nudge.
 */
export async function findSignupNudgeRecipients(
  now: Date,
  limit = 100
): Promise<SignupNudgeRecipient[]> {
  const { gte: gteDate, lt: ltDate } = getSignupNudgeWindow(now);

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
        sql`(select count(*) from cards where cards.user_id = "user"."id" and cards.is_default = false and cards.status = 'completed') > 0`,
        sql`(select count(*) from boards where boards.user_id = "user"."id" and boards.is_unlocked = true) = 0`,
        sql`not exists (select 1 from lifecycle_emails le where le.user_id = "user"."id" and le.type = 'signup_nudge')`
      )
    )
    .limit(limit);

  return rows;
}
