import { eq, desc } from 'drizzle-orm';
import { db, boards, userProfiles } from '@/db';
import { isAdminEmail } from '@/lib/admin';
import { DEFAULT_BOARD_NAME } from '@/lib/constants';

export interface EnsureFirstBoardResult {
  boardId: string;
  /** True when a board was just created, false when the user already had one. */
  created: boolean;
}

/**
 * Find-or-create the user's first board.
 *
 * Used by the `/start` landing route so a brand-new signup is dropped straight
 * into a board (skipping the empty dashboard, a known drop-off point). Idempotent:
 * if the user already has boards, it returns their most recent one and creates
 * nothing — so it's safe to hit on any post-auth redirect.
 */
export async function ensureFirstBoard(user: {
  id: string;
  email?: string | null;
}): Promise<EnsureFirstBoardResult> {
  const existing = await db.query.boards.findMany({
    where: eq(boards.userId, user.id),
    orderBy: [desc(boards.createdAt)],
  });

  if (existing.length > 0) {
    return { boardId: existing[0].id, created: false };
  }

  // Ensure the user profile row exists (mirrors POST /api/boards).
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile) {
    await db.insert(userProfiles).values({ id: user.id });
  }

  const [board] = await db
    .insert(boards)
    .values({
      userId: user.id,
      name: DEFAULT_BOARD_NAME,
      isUnlocked: isAdminEmail(user.email),
    })
    .returning();

  return { boardId: board.id, created: true };
}
