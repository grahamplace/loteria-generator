import { db, user, userProfiles } from '@/db';
import { eq, inArray, sql } from 'drizzle-orm';

export type CampaignRecipient = {
  id: string;
  email: string;
  name: string;
  locale: string | null;
  /** Most recent board, or null when the user has none. */
  boardId: string | null;
};

export async function getCampaignRecipients(userIds: string[]): Promise<CampaignRecipient[]> {
  if (userIds.length === 0) return [];

  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      locale: userProfiles.locale,
      // Templates that deep-link into the product (the empty-board nudge) need a
      // board to point at. Mirrors the subquery the cron recipient query uses.
      boardId: sql<
        string | null
      >`(select id::text from boards where boards.user_id = "user"."id" order by created_at desc limit 1)`.as(
        'board_id'
      ),
    })
    .from(user)
    .leftJoin(userProfiles, eq(userProfiles.id, user.id))
    .where(inArray(user.id, userIds));

  return rows;
}
