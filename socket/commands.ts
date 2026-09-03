/**
 * Command handlers. See docs/adr/0002-live-game-event-protocol.md.
 *
 * THE RULE THIS FILE LIVES BY: the check and the state change that follows it
 * are synchronous, with no `await` between them. ADR 0001 makes this process
 * the sole arbiter for every Game, and that only holds because Node runs one
 * thing at a time — an `await` in the middle of a check-and-set hands the gap
 * to another message and the guarantee is gone. Persistence happens *after* the
 * decision, never inside it.
 *
 * The unique indexes in Postgres are the backstop for when this is violated
 * anyway, not a substitute for getting it right.
 */
import { eq } from 'drizzle-orm';
import { db } from './db';
import { gameCalls, gamePlayers, games, gameWins } from '@/db/schema';
import { findWinningInstance, rejectionFor } from '@/lib/live-game/patterns';
import { CLAIM_WINDOW_SECONDS } from '@/lib/constants';
import type { LiveGame } from './game-registry';
import { broadcast, broadcastToCaller, send, type Conn } from './broadcast';
import { calledCells, markedCells, oneAwayPlayerIds } from './snapshot';

/** Grace before a re-armed timer may fire, so it cannot land on a room still reconnecting. */
export const REARM_GRACE_MS = 15_000;

/** Bump the Game's version. Everything all clients see carries the result. */
function nextVersion(game: LiveGame): number {
  return ++game.version;
}

function callMadeEvent(game: LiveGame, cardId: string, sequence: number) {
  return {
    type: 'call_made' as const,
    version: game.version,
    serverNow: new Date().toISOString(),
    cardId,
    sequence,
    // Everything derived from this Call rides with it. Split into separate
    // events, there would be a window where the one-away list belonged to the
    // previous Call — a state that never exists on the server.
    calledCount: game.calls.length,
    deckRemaining: game.deckCardIds.length - game.calls.length,
    playerCount: game.players.size,
    oneAwayPlayerIds: oneAwayPlayerIds(game),
    nextCallDueAt: game.nextCallDueAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Caller commands
// ---------------------------------------------------------------------------

export type CallResult =
  | { ok: true; cardId: string; sequence: number; deckExhausted: boolean }
  | { ok: false; reason: 'not_playing' | 'claim_window_open' | 'deck_exhausted' };

/**
 * Draw the next card. The whole decision is the four synchronous lines below;
 * everything after is bookkeeping.
 */
export function drawNextCall(game: LiveGame, rng: () => number = Math.random): CallResult {
  if (game.status !== 'playing') return { ok: false, reason: 'not_playing' };
  // Calls stop the instant the first Win lands. Letting one through here would
  // mean a Player claiming inside the window won against a different board than
  // the one the winner saw.
  if (game.winnerIds.length > 0) return { ok: false, reason: 'claim_window_open' };

  const remaining = game.deckCardIds.filter((id) => !game.calledSet.has(id));
  if (remaining.length === 0) return { ok: false, reason: 'deck_exhausted' };

  const cardId = remaining[Math.floor(rng() * remaining.length)];
  // Claim the slot before anything can await. This is the arbitration.
  game.calledSet.add(cardId);
  game.calls.push(cardId);
  const sequence = game.calls.length;

  return { ok: true, cardId, sequence, deckExhausted: remaining.length === 1 };
}

export async function handleCallNext(game: LiveGame): Promise<void> {
  const result = drawNextCall(game);
  if (!result.ok) return;

  game.nextCallDueAt = game.autoAdvanceSeconds
    ? new Date(Date.now() + game.autoAdvanceSeconds * 1000)
    : null;
  nextVersion(game);

  await db.insert(gameCalls).values({
    gameId: game.id,
    cardId: result.cardId,
    sequence: result.sequence,
  });
  await db
    .update(games)
    .set({ version: game.version, nextCallDueAt: game.nextCallDueAt, updatedAt: new Date() })
    .where(eq(games.id, game.id));

  broadcast(game.code, callMadeEvent(game, result.cardId, result.sequence));

  // Running out of cards ends the Game the same way a Win does: everyone gets
  // the Claim Window, then it is over. Under a full-board Pattern every Board
  // is complete by now, so "nobody could claim" would be a lie.
  if (result.deckExhausted) await openClaimWindow(game, 'deck_exhausted');
}

export async function handleSetAutoAdvance(game: LiveGame, seconds: number | null): Promise<void> {
  game.autoAdvanceSeconds = seconds;
  game.nextCallDueAt =
    seconds && game.status === 'playing' && game.winnerIds.length === 0
      ? new Date(Date.now() + seconds * 1000)
      : null;
  nextVersion(game);

  await db
    .update(games)
    .set({
      autoAdvanceSeconds: seconds,
      nextCallDueAt: game.nextCallDueAt,
      version: game.version,
      updatedAt: new Date(),
    })
    .where(eq(games.id, game.id));

  broadcast(game.code, {
    type: 'auto_advance_changed',
    version: game.version,
    serverNow: new Date().toISOString(),
    autoAdvanceSeconds: seconds,
    nextCallDueAt: game.nextCallDueAt?.toISOString() ?? null,
  });
}

export async function handleLockJoins(game: LiveGame, locked: boolean): Promise<void> {
  game.joinsLocked = locked;
  nextVersion(game);
  await db
    .update(games)
    .set({ joinsLocked: locked, version: game.version, updatedAt: new Date() })
    .where(eq(games.id, game.id));
  broadcast(game.code, { type: 'joins_locked_changed', version: game.version, locked });
}

export async function handleStartGame(game: LiveGame): Promise<void> {
  if (game.status !== 'lobby') return;
  game.status = 'playing';
  game.nextCallDueAt = game.autoAdvanceSeconds
    ? new Date(Date.now() + game.autoAdvanceSeconds * 1000)
    : null;
  nextVersion(game);

  await db
    .update(games)
    .set({
      status: 'playing',
      startedAt: new Date(),
      nextCallDueAt: game.nextCallDueAt,
      version: game.version,
      updatedAt: new Date(),
    })
    .where(eq(games.id, game.id));

  broadcast(game.code, {
    type: 'game_started',
    version: game.version,
    serverNow: new Date().toISOString(),
    pattern: game.pattern,
    nextCallDueAt: game.nextCallDueAt?.toISOString() ?? null,
  });
}

export async function handleEndGame(
  game: LiveGame,
  reason: 'caller_ended' | 'expired'
): Promise<void> {
  if (game.status === 'ended') return;
  const endReason = game.winnerIds.length > 0 ? 'won' : reason;
  game.status = 'ended';
  game.claimWindowClosesAt = null;
  game.nextCallDueAt = null;
  nextVersion(game);

  await db
    .update(games)
    .set({
      status: 'ended',
      endReason,
      endedAt: new Date(),
      claimWindowClosesAt: null,
      nextCallDueAt: null,
      version: game.version,
      updatedAt: new Date(),
    })
    .where(eq(games.id, game.id));

  broadcast(game.code, {
    type: 'game_ended',
    version: game.version,
    serverNow: new Date().toISOString(),
    reason: endReason,
    winnerIds: game.winnerIds,
  });
}

// ---------------------------------------------------------------------------
// Player commands
// ---------------------------------------------------------------------------

export async function handleMark(
  game: LiveGame,
  playerId: string,
  cardId: string,
  marked: boolean
): Promise<void> {
  const player = game.players.get(playerId);
  if (!player) return;
  // Only cells on this Player's own Board. A Mark on a card they do not hold
  // could never win, but it would still show up on the Caller's tray.
  if (!player.boardCardIds.includes(cardId)) return;

  if (marked) player.markedCardIds.add(cardId);
  else player.markedCardIds.delete(cardId);

  // Deliberately does NOT bump the Game version: Marks go only to the Caller,
  // so a Player would see the version jump with no events in between and
  // re-snapshot on every tap anyone made. See ADR 0002.
  await db
    .update(gamePlayers)
    .set({ markedCardIds: [...player.markedCardIds] })
    .where(eq(gamePlayers.id, playerId));

  broadcastToCaller(game.code, { type: 'marks_changed', playerId, cardId, marked });
}

export async function handleRename(
  game: LiveGame,
  playerId: string,
  nickname: string
): Promise<void> {
  const player = game.players.get(playerId);
  if (!player) return;
  const trimmed = nickname.trim();
  if (!trimmed || trimmed.length > 16) return;
  for (const other of game.players.values()) {
    if (other.id !== playerId && other.nickname === trimmed) return;
  }

  player.nickname = trimmed;
  nextVersion(game);
  await db.update(gamePlayers).set({ nickname: trimmed }).where(eq(gamePlayers.id, playerId));
  broadcast(game.code, {
    type: 'player_renamed',
    version: game.version,
    playerId,
    nickname: trimmed,
  });
}

/**
 * A Claim carries nothing but the assertion. The server verifies against its
 * own stored Marks, so there is no mark set handed to it at the exact moment it
 * decides the Game.
 */
export async function handleClaim(game: LiveGame, playerId: string, conn: Conn): Promise<void> {
  const player = game.players.get(playerId);
  if (!player || game.status !== 'playing') return;

  if (game.winnerIds.includes(playerId)) return;

  const called = calledCells(player, game);
  const instance = findWinningInstance(called, markedCells(player), game.pattern);

  if (instance === null) {
    // Name the reason, never the cells: listing them would turn the button into
    // a cheat sheet that reads out the answer.
    send(conn, { type: 'claim_rejected', reason: rejectionFor(called, game.pattern) });
    return;
  }

  const firstWin = game.winnerIds.length === 0;
  game.winnerIds.push(playerId);
  nextVersion(game);

  await db.insert(gameWins).values({
    gameId: game.id,
    playerId,
    patternInstance: instance,
    wonOnSequence: game.calls.length,
  });

  broadcast(game.code, {
    type: 'win_recorded',
    version: game.version,
    serverNow: new Date().toISOString(),
    playerId,
    nickname: player.nickname,
    patternInstance: instance,
    wonOnSequence: game.calls.length,
  });

  if (firstWin) await openClaimWindow(game, 'won');
}

// ---------------------------------------------------------------------------
// The Claim Window
// ---------------------------------------------------------------------------

/**
 * Freeze Calls and let later Claims still count. Because Calls have stopped,
 * every Claim inside the window is verified against the same Call — which is
 * what "simultaneous winners all win" means made concrete.
 *
 * Timed in auto-advance; in manual the Caller ends it, because at a human pace
 * there is a human there to decide.
 */
export async function openClaimWindow(
  game: LiveGame,
  cause: 'won' | 'deck_exhausted'
): Promise<void> {
  game.nextCallDueAt = null;
  game.claimWindowClosesAt = game.autoAdvanceSeconds
    ? new Date(Date.now() + CLAIM_WINDOW_SECONDS * 1000)
    : null;
  nextVersion(game);

  await db
    .update(games)
    .set({
      nextCallDueAt: null,
      claimWindowClosesAt: game.claimWindowClosesAt,
      version: game.version,
      updatedAt: new Date(),
    })
    .where(eq(games.id, game.id));

  broadcast(game.code, {
    type: 'claim_window_opened',
    version: game.version,
    serverNow: new Date().toISOString(),
    cause,
    // null means manual: no countdown, the Caller taps End game.
    closesAt: game.claimWindowClosesAt?.toISOString() ?? null,
  });
}

/**
 * A Player nobody in this Game has seen before.
 *
 * Distinct from presence: presence toggles a flag on someone already on the
 * roster, this adds them to it. The Caller's lobby count depends on it, and so
 * does every Player's "N players" line.
 */
export function broadcastPlayerJoined(game: LiveGame, playerId: string): void {
  const player = game.players.get(playerId);
  if (!player) return;
  nextVersion(game);
  broadcast(game.code, {
    type: 'player_joined',
    version: game.version,
    playerId,
    nickname: player.nickname,
    playerCount: game.players.size,
  });
}

/** Presence changed for one Player — the roster's online flag, nothing else. */
export function broadcastPresence(game: LiveGame, playerId: string): void {
  const player = game.players.get(playerId);
  if (!player) return;
  nextVersion(game);
  broadcast(game.code, {
    type: 'player_presence_changed',
    version: game.version,
    playerId,
    online: player.connections > 0,
  });
  // Not persisted: presence is derived from live sockets and every client
  // reconnects after a restart, so there is nothing worth writing down.
}
