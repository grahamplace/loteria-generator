/**
 * The auto-advance clock and the Claim Window countdown.
 *
 * Both are in-process `setTimeout`s next to the Game object, which is only safe
 * because this process is the sole arbiter — two servers would mean two clocks
 * drawing cards into the same Game.
 *
 * `next_call_due_at` is persisted with the Call that sets it, so a deploy does
 * not silently stop a running Game. On boot the timer re-arms at
 * `max(persisted deadline, now + grace)`: without the grace it would fire into
 * a room that is still reconnecting, and the first card after a restart would
 * be called to an empty room.
 */
import { handleCallNext, handleEndGame, REARM_GRACE_MS } from './commands';
import type { LiveGame } from './game-registry';

const timers = new Map<string, NodeJS.Timeout>();

export function clearTimer(gameCode: string): void {
  const t = timers.get(gameCode);
  if (t) {
    clearTimeout(t);
    timers.delete(gameCode);
  }
}

function armAt(game: LiveGame, when: Date, fire: () => void): void {
  clearTimer(game.code);
  const delay = Math.max(0, when.getTime() - Date.now());
  timers.set(
    game.code,
    setTimeout(() => {
      timers.delete(game.code);
      void Promise.resolve(fire()).catch((err) =>
        console.error(`[timer] ${game.code}:`, (err as Error).message)
      );
    }, delay)
  );
}

/**
 * Point the Game's single timer at whatever should happen next: close the Claim
 * Window, or draw the next card. One timer per Game, not one per concern —
 * during a Claim Window there is no next Call, and vice versa.
 */
export function reschedule(game: LiveGame, opts: { boot?: boolean } = {}): void {
  clearTimer(game.code);
  if (game.status !== 'playing') return;

  const grace = opts.boot ? REARM_GRACE_MS : 0;

  if (game.claimWindowClosesAt) {
    armAt(game, new Date(Math.max(game.claimWindowClosesAt.getTime(), Date.now() + grace)), () =>
      handleEndGame(game, 'caller_ended')
    );
    return;
  }

  if (game.nextCallDueAt && game.autoAdvanceSeconds) {
    armAt(game, new Date(Math.max(game.nextCallDueAt.getTime(), Date.now() + grace)), async () => {
      await handleCallNext(game);
      // Chain rather than setInterval: each Call decides whether there is a
      // next one, and a Win or an empty deck stops the clock by leaving
      // nextCallDueAt null.
      reschedule(game);
    });
  }
}

export function clearAllTimers(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

export function armedCount(): number {
  return timers.size;
}
