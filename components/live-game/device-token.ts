'use client';

/**
 * The per-device Player token.
 *
 * Identity is this value, never the nickname — Jackbox keys the seat to a
 * stored id and still documents that renaming on rejoin causes permanent
 * lockout, which is a bug papered over with support copy. Here a rename is just
 * a label change.
 *
 * Scoped per Game so two tabs on two Games are two Players, and stored under
 * one key per Code so returning to a Game you left restores that seat.
 */
const KEY = (gameCode: string) => `loteria.player-token.${gameCode}`;

export function getDeviceToken(gameCode: string): string {
  try {
    const existing = localStorage.getItem(KEY(gameCode));
    if (existing) return existing;
    const token = crypto.randomUUID();
    localStorage.setItem(KEY(gameCode), token);
    return token;
  } catch {
    // Private windows and blocked site data throw rather than returning null.
    // A per-session token still plays a Game; it just cannot survive a refresh,
    // which is better than refusing to let someone join at all.
    return crypto.randomUUID();
  }
}
