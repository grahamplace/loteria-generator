/**
 * Board assignment. See docs/live-play-spec.md §6.
 *
 * A Board is 16 card ids **in order**: position i is grid cell i. Two Boards
 * are the same only if they hold the same cards in the same positions, because
 * positional Patterns are arrangement-sensitive — the same sixteen cards
 * shuffled completes a row at a different time, so those Players are not
 * interchangeable and must not be treated as duplicates.
 *
 * Pure and shared with the socket server: no database, no env.
 */
import { createHash } from 'node:crypto';
import { BOARD_CELL_COUNT } from './patterns';

export { BOARD_CELL_COUNT };

/** Injectable so tests are deterministic; defaults to Math.random. */
export type Rng = () => number;

/**
 * Canonical identity of a Board: SHA-256 of the ids **in order**.
 *
 * Sixty-four indexable characters instead of a ~600-character joined id list,
 * and the ordering is the whole point — sorting here would silently merge
 * Boards that play differently.
 */
export function boardKeyFor(orderedCardIds: readonly string[]): string {
  return createHash('sha256').update(orderedCardIds.join(',')).digest('hex');
}

/**
 * One candidate Board: shuffle the Set's cards and take the first sixteen.
 * That order *is* the arrangement — the server chooses it, so a tampered client
 * cannot re-arrange its own Board mid-Game to reach a row sooner.
 */
export function drawBoard(cardIds: readonly string[], rng: Rng = Math.random): string[] {
  if (cardIds.length < BOARD_CELL_COUNT) {
    throw new Error(`need at least ${BOARD_CELL_COUNT} cards, got ${cardIds.length}`);
  }
  const pool = [...cardIds];
  // Fisher-Yates, but only far enough to fill the Board. Shuffling the whole
  // deck to take sixteen of fifty-four is wasted work per join.
  for (let i = 0; i < BOARD_CELL_COUNT; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, BOARD_CELL_COUNT);
}
