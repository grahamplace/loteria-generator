import { describe, it, expect } from 'vitest';
import {
  PATTERN_INSTANCES,
  GAME_PATTERNS,
  BOARD_CELL_COUNT,
  findWinningInstance,
  isOneAway,
  rejectionFor,
  isGamePattern,
} from '@/lib/live-game/patterns';

const cells = (...n: number[]) => new Set(n);
const ROW_2 = [4, 5, 6, 7];

describe('the Pattern table', () => {
  it('covers the six Patterns in thirteen instances', () => {
    expect(GAME_PATTERNS).toHaveLength(6);
    const total = GAME_PATTERNS.reduce((n, p) => n + PATTERN_INSTANCES[p].length, 0);
    expect(total).toBe(13);
  });

  it('only ever names cells on the board, with no repeats inside an instance', () => {
    for (const pattern of GAME_PATTERNS) {
      for (const instance of PATTERN_INSTANCES[pattern]) {
        expect(new Set(instance).size).toBe(instance.length);
        for (const cell of instance) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThan(BOARD_CELL_COUNT);
        }
      }
    }
  });

  it('puts the diagonals on the real corners, not a transposed grid', () => {
    // A row-vs-column mix-up survives most tests; these two literals do not.
    expect(PATTERN_INSTANCES.any_diagonal).toEqual([
      [0, 5, 10, 15],
      [3, 6, 9, 12],
    ]);
    expect(PATTERN_INSTANCES.four_corners).toEqual([[0, 3, 12, 15]]);
  });

  it('rejects unknown pattern names', () => {
    expect(isGamePattern('any_row')).toBe(true);
    expect(isGamePattern('blackout')).toBe(false);
    expect(isGamePattern(undefined)).toBe(false);
  });
});

describe('a Win needs Called and Marked', () => {
  it('wins when one instance is fully Called and fully Marked', () => {
    expect(findWinningInstance(cells(...ROW_2), cells(...ROW_2), 'any_row')).toBe(1);
  });

  it('does not win on a Board that completed while the Player was not looking', () => {
    // Every card Called, none tapped. This is the rule that makes attention
    // the game rather than decoration.
    expect(findWinningInstance(cells(...ROW_2), cells(), 'any_row')).toBeNull();
  });

  it('does not win on Marks the Caller never Called', () => {
    // Honor-system marking means a Player can tap anything; the server only
    // counts Marks that sit on Calls.
    expect(findWinningInstance(cells(), cells(...ROW_2), 'any_row')).toBeNull();
  });

  it('returns which instance won, so the Win can record it', () => {
    const col4 = [3, 7, 11, 15];
    expect(findWinningInstance(cells(...col4), cells(...col4), 'any_column')).toBe(3);
  });

  it('needs every cell, not most of them', () => {
    const almost = [4, 5, 6];
    expect(findWinningInstance(cells(...almost), cells(...almost), 'any_row')).toBeNull();
  });
});

describe('why a Claim was rejected', () => {
  it('says not-all-called when the Player could not possibly have won yet', () => {
    expect(rejectionFor(cells(4, 5, 6), 'any_row')).toBe('not_all_called');
  });

  it('says not-all-marked when the cards were there and the taps were not', () => {
    expect(rejectionFor(cells(...ROW_2), 'any_row')).toBe('not_all_marked');
  });
});

describe('one away reads Calls only', () => {
  it('is one away with three of four Called', () => {
    expect(isOneAway(cells(4, 5, 6), 'any_row')).toBe(true);
  });

  it('is not one away two short', () => {
    expect(isOneAway(cells(4, 5), 'any_row')).toBe(false);
  });

  it('is not one away once the instance is complete — that is a Win, not a warning', () => {
    expect(isOneAway(cells(...ROW_2), 'any_row')).toBe(false);
  });

  it('ignores Marks entirely: a Player who has tapped nothing still shows one away', () => {
    // The feed measures the Board's luck; the Win measures the Player's
    // attention. Blurring them is the mistake this test exists to catch.
    expect(isOneAway(cells(4, 5, 6), 'any_row')).toBe(true);
  });

  it('sees one away across any instance, not just the first', () => {
    expect(isOneAway(cells(12, 13, 14), 'any_row')).toBe(true);
  });

  it('needs fifteen of sixteen for a full board', () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => i);
    expect(isOneAway(new Set(fifteen), 'full_board')).toBe(true);
    expect(isOneAway(new Set(fifteen.slice(0, 14)), 'full_board')).toBe(false);
  });
});
