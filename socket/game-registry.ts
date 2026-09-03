/**
 * The in-memory working copy of each Game, and how it is rebuilt from Postgres.
 *
 * ADR 0001 makes this process the sole arbiter: one server owns every Game, so
 * a check-and-set with no `await` between the check and the set cannot
 * interleave. Everything here is therefore written to be *synchronous* once the
 * Game is loaded — the moment an `await` appears between reading state and
 * writing it, that guarantee is gone.
 *
 * Postgres remains the source of truth. This is a cache that can always be
 * thrown away and rebuilt, which is exactly what happens on every deploy.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from './db';
import { cards, gameCalls, gamePlayers, games, gameWins } from '@/db/schema';
import type { GamePattern, GameStatus } from '@/db/schema';

export type LivePlayer = {
  id: string;
  nickname: string;
  /** 16 card ids in order: position i is grid cell i. */
  boardCardIds: string[];
  markedCardIds: Set<string>;
  /** Live socket count. Zero means offline, never removed from the Game. */
  connections: number;
};

export type LiveGame = {
  id: string;
  code: string;
  setId: string;
  status: GameStatus;
  pattern: GamePattern;
  joinsLocked: boolean;
  autoAdvanceSeconds: number | null;
  nextCallDueAt: Date | null;
  claimWindowClosesAt: Date | null;
  version: number;
  /** Every card in the Set, so a draw knows what is left. */
  deckCardIds: string[];
  /** Called cards in draw order. Index + 1 is the Call's sequence. */
  calls: string[];
  calledSet: Set<string>;
  players: Map<string, LivePlayer>;
  /** playerId, in win order. */
  winnerIds: string[];
};

const byCode = new Map<string, LiveGame>();
/** Guards against two concurrent connections both triggering a rehydrate. */
const loading = new Map<string, Promise<LiveGame | null>>();

/**
 * Materialise a Game from Postgres. The `ws` server does this on the first
 * socket that names a Code — there is no HTTP from Next.js telling it to.
 */
async function rehydrate(code: string): Promise<LiveGame | null> {
  const [row] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!row || row.status === 'ended') return null;

  const [setCards, playerRows, callRows, winRows] = await Promise.all([
    db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.boardId, row.boardId), eq(cards.status, 'completed'))),
    db.select().from(gamePlayers).where(eq(gamePlayers.gameId, row.id)),
    db
      .select()
      .from(gameCalls)
      .where(eq(gameCalls.gameId, row.id))
      .orderBy(asc(gameCalls.sequence)),
    db.select().from(gameWins).where(eq(gameWins.gameId, row.id)).orderBy(asc(gameWins.wonAt)),
  ]);

  const calls = callRows.map((c) => c.cardId);
  return {
    id: row.id,
    code: row.code,
    setId: row.boardId,
    status: row.status,
    pattern: row.pattern,
    joinsLocked: row.joinsLocked,
    autoAdvanceSeconds: row.autoAdvanceSeconds,
    nextCallDueAt: row.nextCallDueAt,
    claimWindowClosesAt: row.claimWindowClosesAt,
    version: row.version,
    deckCardIds: setCards.map((c) => c.id),
    calls,
    calledSet: new Set(calls),
    players: new Map(
      playerRows.map((p) => [
        p.id,
        {
          id: p.id,
          nickname: p.nickname,
          boardCardIds: p.boardCardIds,
          markedCardIds: new Set(p.markedCardIds),
          // Connections are per-process and cannot be restored: every client
          // reconnects after a restart, so everyone starts offline and the
          // roster fills back in as sockets arrive.
          connections: 0,
        },
      ])
    ),
    winnerIds: winRows.map((w) => w.playerId),
  };
}

/**
 * The Game for a Code, loading it once even if twenty phones arrive together.
 * The in-flight promise is shared rather than the load being repeated, which is
 * the same single-arbiter discipline applied to startup.
 */
export async function getGame(code: string): Promise<LiveGame | null> {
  const cached = byCode.get(code);
  if (cached) return cached;

  const inFlight = loading.get(code);
  if (inFlight) return inFlight;

  const promise = rehydrate(code)
    .then((game) => {
      if (game) byCode.set(code, game);
      return game;
    })
    .finally(() => loading.delete(code));

  loading.set(code, promise);
  return promise;
}

/**
 * Load a Player the cached Game has not seen.
 *
 * Joining happens in Next.js — it inserts a `game_players` row and mints a
 * ticket — and ADR 0001 makes Postgres the only interface between the two, so
 * there is no message telling this server a new seat exists. A Game cached
 * before someone joined therefore does not know them, and their socket would be
 * rejected as `no_such_player` even though the row is right there.
 *
 * The ticket naming them is signed, so it is trustworthy; the cache is simply
 * stale. Pull the row rather than being pushed to, which keeps the boundary
 * intact.
 *
 * Returns null when the Player genuinely does not exist — a ticket for a
 * deleted row, or for another Game.
 */
export async function ensurePlayer(game: LiveGame, playerId: string): Promise<LivePlayer | null> {
  const known = game.players.get(playerId);
  if (known) return known;

  const [row] = await db
    .select()
    .from(gamePlayers)
    .where(and(eq(gamePlayers.id, playerId), eq(gamePlayers.gameId, game.id)))
    .limit(1);
  if (!row) return null;

  // Re-check after the await: another connection for the same Player may have
  // loaded them while this one was waiting, and two entries would mean two
  // Boards for one seat.
  const raced = game.players.get(playerId);
  if (raced) return raced;

  const player: LivePlayer = {
    id: row.id,
    nickname: row.nickname,
    boardCardIds: row.boardCardIds,
    markedCardIds: new Set(row.markedCardIds),
    connections: 0,
  };
  game.players.set(playerId, player);
  return player;
}

/** Drop a finished Game so it stops occupying memory. */
export function forgetGame(code: string): void {
  byCode.delete(code);
}

export function liveGameCount(): number {
  return byCode.size;
}

/** Every loaded Game, for /health and for shutdown. */
export function allGames(): LiveGame[] {
  return [...byCode.values()];
}
