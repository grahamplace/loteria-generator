'use server';

import { headers } from 'next/headers';
import { and, eq, ne, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { boards, cards, gamePlayers, games, type GamePattern } from '@/db/schema';
import { generateGameCode, isValidGameCodeFormat } from '@/lib/live-game/game-code';
import { boardKeyFor, drawBoard } from '@/lib/live-game/board';
import { mintTicket } from '@/lib/live-game/ticket';
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

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

export type JoinGameResult =
  | {
      ok: true;
      gameCode: string;
      playerId: string;
      nickname: string;
      /** 16 card ids in order: position i is grid cell i. */
      boardCardIds: string[];
      /** Marks already made — a returning Player must get their beans back. */
      markedCardIds: string[];
      /** Short-lived HMAC ticket for the socket handshake. */
      ticket: string;
      /** True when this device already held a seat and got it back. */
      restored: boolean;
    }
  | {
      ok: false;
      reason:
        | 'invalid_code'
        | 'no_such_game'
        | 'game_ended'
        | 'joins_locked'
        | 'game_full'
        | 'nickname_taken'
        | 'nickname_invalid'
        | 'board_assignment_failed';
    };

const MAX_NICKNAME_LENGTH = 16;
const BOARD_DRAW_MAX_ATTEMPTS = 8;

/**
 * Joining a Game. No account: identity is the per-device token.
 *
 * Returning with a token this Game has seen restores the same seat, Board and
 * Marks — a Player is never dropped, so reconnecting is a lookup, not a rejoin.
 * That is also why nothing here is destructive: a second call with the same
 * token must not deal a new Board.
 */
export async function joinGame(
  code: string,
  nickname: string,
  deviceToken: string
): Promise<JoinGameResult> {
  if (!isValidGameCodeFormat(code)) return { ok: false, reason: 'invalid_code' };

  const trimmed = nickname.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NICKNAME_LENGTH) {
    return { ok: false, reason: 'nickname_invalid' };
  }

  const [game] = await db
    .select({
      id: games.id,
      code: games.code,
      boardId: games.boardId,
      status: games.status,
      joinsLocked: games.joinsLocked,
    })
    .from(games)
    .where(eq(games.code, code))
    .limit(1);

  // Distinct from `game_ended` on purpose: Codes are never reused, so an old
  // link can say "this Game has ended" rather than "no such Game", which is
  // both true and a better next step.
  if (!game) return { ok: false, reason: 'no_such_game' };
  if (game.status === 'ended') return { ok: false, reason: 'game_ended' };

  // Reconnect first, before any capacity or lock check: someone already in the
  // Game must be able to get back in even after the Caller locks joins or the
  // Game fills up. They are not joining, they are returning.
  const [existing] = await db
    .select({
      id: gamePlayers.id,
      nickname: gamePlayers.nickname,
      boardCardIds: gamePlayers.boardCardIds,
      markedCardIds: gamePlayers.markedCardIds,
    })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.playerToken, deviceToken)))
    .limit(1);

  if (existing) {
    return {
      ok: true,
      gameCode: game.code,
      playerId: existing.id,
      nickname: existing.nickname,
      boardCardIds: existing.boardCardIds,
      markedCardIds: existing.markedCardIds,
      ticket: mintTicket({ gameCode: game.code, role: 'player', playerId: existing.id }),
      restored: true,
    };
  }

  if (game.joinsLocked) return { ok: false, reason: 'joins_locked' };

  const [{ count: playerCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gamePlayers)
    .where(eq(gamePlayers.gameId, game.id));
  if (playerCount >= MAX_PLAYERS_PER_GAME) return { ok: false, reason: 'game_full' };

  const setCards = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.boardId, game.boardId), eq(cards.status, 'completed')));
  const cardIds = setCards.map((c) => c.id);

  // Draw, try to claim, redraw on collision. The unique index on
  // (game_id, board_key) is the arbiter here, not a pre-flight SELECT — two
  // simultaneous joins would both pass a check and then collide.
  for (let attempt = 0; attempt < BOARD_DRAW_MAX_ATTEMPTS; attempt++) {
    const boardCardIds = drawBoard(cardIds);
    const [row] = await db
      .insert(gamePlayers)
      .values({
        gameId: game.id,
        playerToken: deviceToken,
        nickname: trimmed,
        boardCardIds,
        boardKey: boardKeyFor(boardCardIds),
      })
      .onConflictDoNothing()
      .returning({ id: gamePlayers.id });

    if (row) {
      return {
        ok: true,
        gameCode: game.code,
        playerId: row.id,
        nickname: trimmed,
        boardCardIds,
        markedCardIds: [],
        ticket: mintTicket({ gameCode: game.code, role: 'player', playerId: row.id }),
        restored: false,
      };
    }

    // A conflict is a duplicate Board (redraw fixes it, and at ~10^-14 per draw
    // it essentially never happens) or a taken nickname (redrawing never will).
    // Ask which, so the Player gets "that name is taken" instead of a retry.
    const [nameTaken] = await db
      .select({ id: gamePlayers.id })
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.nickname, trimmed)))
      .limit(1);
    if (nameTaken) return { ok: false, reason: 'nickname_taken' };
  }

  return { ok: false, reason: 'board_assignment_failed' };
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

/**
 * A fresh Caller ticket.
 *
 * Tickets live ~60 seconds, so every reconnect needs a new one — which is also
 * the point at which the Caller's ownership is re-checked. A stolen ticket buys
 * a minute; a revoked session buys nothing.
 */
export async function getCallerTicket(
  code: string
): Promise<{ ok: true; ticket: string } | { ok: false; reason: 'unauthenticated' | 'not_caller' }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, reason: 'unauthenticated' };

  // The Caller is the Set's owner. Joined rather than trusted from the ticket,
  // because the ticket is what we are about to mint.
  const [row] = await db
    .select({ code: games.code })
    .from(games)
    .innerJoin(boards, eq(games.boardId, boards.id))
    .where(and(eq(games.code, code), eq(boards.userId, session.user.id)))
    .limit(1);

  if (!row) return { ok: false, reason: 'not_caller' };
  return { ok: true, ticket: mintTicket({ gameCode: row.code, role: 'caller', playerId: null }) };
}
