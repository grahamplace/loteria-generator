'use server';

import { headers } from 'next/headers';
import { and, eq, ne, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { boards, cards, games, type GamePattern } from '@/db/schema';
import { generateGameCode } from '@/lib/live-game/game-code';
import { isGamePattern } from '@/lib/live-game/patterns';
import {
  GAME_CODE_MAX_ATTEMPTS,
  MAX_PLAYERS_PER_GAME,
  MIN_GAME_CARD_COUNT,
  SMALL_SET_ADVISORY_CARD_COUNT,
} from '@/lib/constants';

/**
 * Starting a Game. See docs/live-play-spec.md §2.
 *
 * This is the entire Vercel→Fly interface. There is no HTTP to the socket
 * server: Next.js validates and inserts the `games` row, and the `ws` server
 * materialises the Game from Postgres on the first socket that names its Code.
 * If Fly is down, "Play" still works — the page just cannot connect yet.
 */

export type CreateGameResult =
  | { ok: true; code: string; gameId: string; playerCap: number; smallSetAdvisory: boolean }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'not_your_set'
        | 'set_locked'
        | 'too_few_cards'
        | 'game_already_running'
        | 'invalid_pattern'
        | 'code_generation_failed';
      /** Only for `too_few_cards`, so the copy can say how many are missing. */
      cardCount?: number;
      /** Only for `game_already_running`, so the UI can offer Resume. */
      existingCode?: string;
    };

export async function createGame(
  setId: string,
  pattern: GamePattern,
  autoAdvanceSeconds: number | null = null
): Promise<CreateGameResult> {
  if (!isGamePattern(pattern)) return { ok: false, reason: 'invalid_pattern' };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, reason: 'unauthenticated' };

  const [set] = await db
    .select({ id: boards.id, userId: boards.userId, isUnlocked: boards.isUnlocked })
    .from(boards)
    .where(eq(boards.id, setId))
    .limit(1);

  // Same answer for "does not exist" and "belongs to someone else": a Set id is
  // guessable, and confirming one exists would leak that.
  if (!set || set.userId !== session.user.id) return { ok: false, reason: 'not_your_set' };
  if (!set.isUnlocked) return { ok: false, reason: 'set_locked' };

  const [{ count: cardCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cards)
    .where(and(eq(cards.boardId, setId), eq(cards.status, 'completed')));

  // More than 16, not at least 16: a Set with exactly one Board's worth of
  // cards gives every Player the same sixteen.
  if (cardCount < MIN_GAME_CARD_COUNT) return { ok: false, reason: 'too_few_cards', cardCount };

  // Checked here so the Caller gets "Resume or End" rather than a constraint
  // violation. `games_one_active_per_set` is the backstop, not the check —
  // two simultaneous clicks race past this and the index catches the loser.
  const [running] = await db
    .select({ code: games.code })
    .from(games)
    .where(and(eq(games.boardId, setId), ne(games.status, 'ended')))
    .limit(1);
  if (running) return { ok: false, reason: 'game_already_running', existingCode: running.code };

  // Codes are never reused, so the insert is the uniqueness check. No
  // pre-flight SELECT: that would be a race, this is not.
  for (let attempt = 0; attempt < GAME_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateGameCode();
    const [row] = await db
      .insert(games)
      .values({ boardId: setId, code, pattern, autoAdvanceSeconds, status: 'lobby' })
      .onConflictDoNothing()
      .returning({ id: games.id, code: games.code });

    if (row) {
      return {
        ok: true,
        code: row.code,
        gameId: row.id,
        // A flat 50. The combinatorial limit never binds: even a 17-card Set
        // yields 3.6e14 distinct Boards, because arrangement makes them differ.
        playerCap: MAX_PLAYERS_PER_GAME,
        smallSetAdvisory: cardCount < SMALL_SET_ADVISORY_CARD_COUNT,
      };
    }
    // A conflict here is either a Code collision (1 in ~10^6 minus those taken)
    // or `games_one_active_per_set` catching a create that raced this one.
    // Retrying resolves the first and can never resolve the second, which is
    // why exhaustion is re-diagnosed below rather than reported as-is.
  }

  // Exhausting attempts almost always means the partial index rejected every
  // one — another click won the race — not that five random Codes all collided
  // (~10^-30). Ask, so the Caller gets Resume rather than "try again".
  const [wonBySomeoneElse] = await db
    .select({ code: games.code })
    .from(games)
    .where(and(eq(games.boardId, setId), ne(games.status, 'ended')))
    .limit(1);
  if (wonBySomeoneElse) {
    return { ok: false, reason: 'game_already_running', existingCode: wonBySomeoneElse.code };
  }

  return { ok: false, reason: 'code_generation_failed' };
}
