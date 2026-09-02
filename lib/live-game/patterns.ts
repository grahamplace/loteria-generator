/**
 * Win Patterns. See docs/live-play-spec.md §6.
 *
 * Shared by Next.js and the socket server, so this file must stay pure — no
 * database, no env, no Node built-ins.
 *
 * A Pattern has one or more *instances*: "any row" is four of them, and
 * completing any single instance wins. Instances are the unit both verification
 * and the one-away feed iterate over.
 *
 * Cells are the 4×4 grid in reading order:
 *
 *    0  1  2  3
 *    4  5  6  7
 *    8  9 10 11
 *   12 13 14 15
 */
import type { GamePattern } from '@/db/schema';

export const BOARD_CELL_COUNT = 16;

/** Cell indices of each instance, by Pattern. */
export const PATTERN_INSTANCES: Record<GamePattern, readonly (readonly number[])[]> = {
  full_board: [Array.from({ length: BOARD_CELL_COUNT }, (_, i) => i)],
  any_row: [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
  ],
  any_column: [
    [0, 4, 8, 12],
    [1, 5, 9, 13],
    [2, 6, 10, 14],
    [3, 7, 11, 15],
  ],
  any_diagonal: [
    [0, 5, 10, 15],
    [3, 6, 9, 12],
  ],
  four_corners: [[0, 3, 12, 15]],
  centre: [[5, 6, 9, 10]],
} as const;

export const GAME_PATTERNS = Object.keys(PATTERN_INSTANCES) as GamePattern[];

export function isGamePattern(value: unknown): value is GamePattern {
  return typeof value === 'string' && value in PATTERN_INSTANCES;
}

/**
 * The winning instance, or null. A Win needs every cell of one instance both
 * Called and Marked — paying attention is the game, so a Board that completed
 * while its Player was not looking does not win.
 */
export function findWinningInstance(
  calledCells: ReadonlySet<number>,
  markedCells: ReadonlySet<number>,
  pattern: GamePattern
): number | null {
  const instances = PATTERN_INSTANCES[pattern];
  for (let i = 0; i < instances.length; i++) {
    if (instances[i].every((cell) => calledCells.has(cell) && markedCells.has(cell))) return i;
  }
  return null;
}

/** Why a Claim was rejected. The Player is told which, never which cells. */
export type ClaimRejection = 'not_all_called' | 'not_all_marked';

export function rejectionFor(
  calledCells: ReadonlySet<number>,
  pattern: GamePattern
): ClaimRejection {
  const anyFullyCalled = PATTERN_INSTANCES[pattern].some((inst) =>
    inst.every((cell) => calledCells.has(cell))
  );
  return anyFullyCalled ? 'not_all_marked' : 'not_all_called';
}

/**
 * One Call away from completing some instance.
 *
 * Reads Calls only, never Marks — the feed measures the Board's luck, the Win
 * measures the Player's attention, and they are different things. A Player can
 * show one away having marked nothing.
 */
export function isOneAway(calledCells: ReadonlySet<number>, pattern: GamePattern): boolean {
  return PATTERN_INSTANCES[pattern].some((inst) => {
    let missing = 0;
    for (const cell of inst) if (!calledCells.has(cell)) missing++;
    return missing === 1;
  });
}
