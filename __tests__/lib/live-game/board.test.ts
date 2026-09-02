import { describe, it, expect } from 'vitest';
import { drawBoard, boardKeyFor, BOARD_CELL_COUNT } from '@/lib/live-game/board';

const deck = (n: number) => Array.from({ length: n }, (_, i) => `card-${i}`);

/** Deterministic rng cycling a fixed sequence, so shuffles are reproducible. */
const seeded = (seed: number) => {
  let x = seed;
  return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
};

describe('drawing a Board', () => {
  it('returns exactly sixteen distinct cards', () => {
    const b = drawBoard(deck(54), seeded(1));
    expect(b).toHaveLength(BOARD_CELL_COUNT);
    expect(new Set(b).size).toBe(BOARD_CELL_COUNT);
  });

  it('only ever uses cards from the Set', () => {
    const cards = deck(20);
    for (const id of drawBoard(cards, seeded(7))) expect(cards).toContain(id);
  });

  it('works on the smallest Game-eligible Set', () => {
    // 17 cards is the minimum. Every Board then holds 16 of the same 17, which
    // is why the lobby warns — but it must still deal.
    const b = drawBoard(deck(17), seeded(3));
    expect(new Set(b).size).toBe(BOARD_CELL_COUNT);
  });

  it('refuses a Set that cannot fill a Board', () => {
    expect(() => drawBoard(deck(15))).toThrow(/at least 16/);
  });

  it('does not mutate the Set it was given', () => {
    const cards = deck(20);
    const before = [...cards];
    drawBoard(cards, seeded(5));
    expect(cards).toEqual(before);
  });

  it('produces different arrangements across draws', () => {
    const cards = deck(54);
    const keys = new Set(
      Array.from({ length: 50 }, (_, i) => boardKeyFor(drawBoard(cards, seeded(i + 1))))
    );
    expect(keys.size).toBeGreaterThan(45);
  });
});

describe('Board identity is order-sensitive', () => {
  const sixteen = deck(16);

  it('gives the same key for the same cards in the same positions', () => {
    expect(boardKeyFor(sixteen)).toBe(boardKeyFor([...sixteen]));
  });

  it('gives a DIFFERENT key for the same cards rearranged', () => {
    // The load-bearing test. If this ever passes as equal, positional Patterns
    // break: two Players would share a Board that completes a row at different
    // times, and one of them would be silently rejected as a duplicate.
    const swapped = [...sixteen];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(boardKeyFor(swapped)).not.toBe(boardKeyFor(sixteen));
  });

  it('is a 64-character hex digest, short enough to index', () => {
    expect(boardKeyFor(sixteen)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not collide across different card sets', () => {
    expect(boardKeyFor(deck(16))).not.toBe(boardKeyFor(deck(16).map((c) => c + 'x')));
  });
});
