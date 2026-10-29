// Users whose safety_identifier OpenAI has blocked. OpenAI cannot lift the
// block, and repeated violations count against the whole organization, so a
// blocked user gets no further AI calls.
import { eq, sql } from 'drizzle-orm';
import { db, userProfiles } from '@/db';

export async function isOpenAIBlocked(userId: string): Promise<boolean> {
  const row = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { openaiBlockedAt: true },
  });
  return row?.openaiBlockedAt != null;
}

/** Records the block. Keeps the first timestamp; works without a profile row. */
export async function markOpenAIBlocked(userId: string): Promise<void> {
  const now = new Date();
  await db
    .insert(userProfiles)
    .values({ id: userId, openaiBlockedAt: now })
    .onConflictDoUpdate({
      target: userProfiles.id,
      set: { openaiBlockedAt: sql`coalesce(${userProfiles.openaiBlockedAt}, ${now})` },
    });
}
