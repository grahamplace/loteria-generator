import { describe, it, expect } from 'vitest';
import { generateGameCode, isValidGameCodeFormat } from '@/lib/live-game/game-code';
import { GAME_CODE_LENGTH } from '@/lib/constants';

describe('Game Codes', () => {
  it('is always six digits, including when the number is small', () => {
    // A code is text, not a number: 000123 must keep its leading zeros or the
    // player types six characters and the lookup misses.
    for (let i = 0; i < 500; i++) {
      const code = generateGameCode();
      expect(code).toHaveLength(GAME_CODE_LENGTH);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('never returns a denylisted code', () => {
    const banned = new Set(['000000', '111111', '123456', '666666', '696969']);
    for (let i = 0; i < 2000; i++) {
      expect(banned.has(generateGameCode())).toBe(false);
    }
  });

  it('spreads across the space rather than clustering', () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateGameCode()));
    // 1000 draws from a million: collisions are possible but a generator stuck
    // on a handful of values would fail this badly.
    expect(seen.size).toBeGreaterThan(990);
  });

  it('validates format without touching the database', () => {
    expect(isValidGameCodeFormat('482913')).toBe(true);
    expect(isValidGameCodeFormat('000000')).toBe(true);
    expect(isValidGameCodeFormat('48291')).toBe(false);
    expect(isValidGameCodeFormat('4829133')).toBe(false);
    expect(isValidGameCodeFormat('48291a')).toBe(false);
    expect(isValidGameCodeFormat(' 482913')).toBe(false);
    expect(isValidGameCodeFormat('')).toBe(false);
  });
});
