/**
 * Role-scoped snapshots. See docs/adr/0002-live-game-event-protocol.md.
 *
 * A client gets one of these on connect and deltas thereafter. It carries the
 * Game `version` it was built at, which is the whole point: a snapshot built at
 * v47 can arrive *after* a v48 Call event, and without the version the client
 * would apply the stale snapshot over the newer event and render a board that
 * is quietly wrong.
 *
 * A Player never receives another Player's Board. Sending all of them would
 * bloat the payload ~50x and put the room's Boards in any Player's devtools.
 */
import { isOneAway } from '@/lib/live-game/patterns';
import type { LiveGame, LivePlayer } from './game-registry';

/** Cell indices on a Board whose card has been Called. */
export function calledCells(player: LivePlayer, game: LiveGame): Set<number> {
  const cells = new Set<number>();
  player.boardCardIds.forEach((cardId, cell) => {
    if (game.calledSet.has(cardId)) cells.add(cell);
  });
  return cells;
}

/** Cell indices the Player has Marked. */
export function markedCells(player: LivePlayer): Set<number> {
  const cells = new Set<number>();
  player.boardCardIds.forEach((cardId, cell) => {
    if (player.markedCardIds.has(cardId)) cells.add(cell);
  });
  return cells;
}

/**
 * Players one Call from completing an instance of the Pattern.
 *
 * Reads Calls only, never Marks — the server has no continuous view of intent,
 * and the feed measures the Board's luck while the Win measures the Player's
 * attention. A Player can appear here having marked nothing.
 */
export function oneAwayPlayerIds(game: LiveGame): string[] {
  const ids: string[] = [];
  for (const player of game.players.values()) {
    if (isOneAway(calledCells(player, game), game.pattern)) ids.push(player.id);
  }
  return ids;
}

function baseState(game: LiveGame) {
  return {
    code: game.code,
    status: game.status,
    pattern: game.pattern,
    joinsLocked: game.joinsLocked,
    autoAdvanceSeconds: game.autoAdvanceSeconds,
    // Absolute deadlines, never ticks: a per-second message to fifty phones is
    // noise, and a countdown driven by the network is hostage to jitter.
    nextCallDueAt: game.nextCallDueAt?.toISOString() ?? null,
    claimWindowClosesAt: game.claimWindowClosesAt?.toISOString() ?? null,
    calls: game.calls,
    calledCount: game.calls.length,
    deckRemaining: game.deckCardIds.length - game.calls.length,
    playerCount: game.players.size,
    winnerIds: game.winnerIds,
  };
}

function roster(game: LiveGame) {
  return [...game.players.values()].map((p) => ({
    playerId: p.id,
    nickname: p.nickname,
    online: p.connections > 0,
  }));
}

export function playerSnapshot(game: LiveGame, playerId: string) {
  const me = game.players.get(playerId);
  return {
    type: 'snapshot' as const,
    role: 'player' as const,
    version: game.version,
    serverNow: new Date().toISOString(),
    game: baseState(game),
    roster: roster(game),
    oneAwayPlayerIds: oneAwayPlayerIds(game),
    you: me
      ? {
          playerId: me.id,
          nickname: me.nickname,
          boardCardIds: me.boardCardIds,
          markedCardIds: [...me.markedCardIds],
        }
      : null,
  };
}

export function callerSnapshot(game: LiveGame) {
  return {
    type: 'snapshot' as const,
    role: 'caller' as const,
    version: game.version,
    serverNow: new Date().toISOString(),
    game: baseState(game),
    roster: roster(game),
    oneAwayPlayerIds: oneAwayPlayerIds(game),
    // The Caller alone sees Boards and Marks, which is what makes the
    // mini-board tray possible. The view keeps it behind a toggle: the Caller's
    // screen may be cast, and a cast screen is a public screen.
    boards: [...game.players.values()].map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      boardCardIds: p.boardCardIds,
      markedCardIds: [...p.markedCardIds],
    })),
  };
}
