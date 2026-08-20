import { eq, desc } from 'drizzle-orm';
import { db, boards, userProfiles } from '@/db';
import { isAdminEmail } from '@/lib/admin';
import { DEFAULT_BOARD_NAME } from '@/lib/constants';

export interface EnsureFirstBoardResult {
  boardId: string;
  /** True when a board was just created, false when the user already had one. */
  created: boolean;
  /**
   * How many boards the user has *after* this call. `created: true` always
   * implies `boardCount: 1`. Callers use it to decide where to send the user:
   * exactly one board means "drop them straight into it".
   */
  boardCount: number;
}

/**
 * Find-or-create the user's first board.
 *
 * Called from two places:
 * - `lib/auth.ts` `databaseHooks.user.create.after` — the invariant. A board
 *   exists the instant the user row does, whatever redirect or provider follows.
 * - the `/start` landing route — the idempotent repair, which also covers users
 *   who signed up before the hook existed.
 *
 * Idempotent: if the user already has boards it returns their most recent one
 * and creates nothing, so it is safe to hit on any post-auth redirect.
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
    return { boardId: existing[0].id, created: false, boardCount: existing.length };
  }

  // Ensure the user profile row exists (mirrors POST /api/boards).
  // onConflictDoNothing because /start can render more than once for the same
  // signup (redirect + RSC prefetch), and a bare insert loses that race with a
  // duplicate-key 500 on the brand-new user's very first page.
  await db.insert(userProfiles).values({ id: user.id }).onConflictDoNothing();

  const [board] = await db
    .insert(boards)
    .values({
      userId: user.id,
      name: DEFAULT_BOARD_NAME,
      isUnlocked: isAdminEmail(user.email),
    })
    .returning();

  return { boardId: board.id, created: true, boardCount: 1 };
}
