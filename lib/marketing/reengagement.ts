import { db, user, userProfiles } from '@/db';
import { eq, inArray } from 'drizzle-orm';

export type ReengagementRecipient = {
  id: string;
  email: string;
  name: string;
  locale: string | null;
};

export async function getReengagementRecipients(
  userIds: string[]
): Promise<ReengagementRecipient[]> {
  if (userIds.length === 0) return [];

  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      locale: userProfiles.locale,
    })
    .from(user)
    .leftJoin(userProfiles, eq(userProfiles.id, user.id))
    .where(inArray(user.id, userIds));

  return rows;
}
