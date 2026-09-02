import { describe, it, expect } from 'vitest';
import { calledCells, markedCells, oneAwayPlayerIds } from '@/socket/snapshot';
import type { LiveGame, LivePlayer } from '@/socket/game-registry';

const card = (i: number) => `card-${i}`;
const board = Array.from({ length: 16 }, (_, i) => card(i));

const player = (id: string, marked: number[] = []): LivePlayer => ({
  id,
  nickname: id,
  boardCardIds: [...board],
  markedCardIds: new Set(marked.map(card)),
  connections: 1,
});

const game = (called: number[], players: LivePlayer[]): LiveGame =>
  ({
    id: 'g',
    code: '111222',
    setId: 's',
    status: 'playing',
    pattern: 'any_row',
    joinsLocked: false,
    autoAdvanceSeconds: null,
    nextCallDueAt: null,
    claimWindowClosesAt: null,
    version: 3,
    deckCardIds: board,
    calls: called.map(card),
    calledSet: new Set(called.map(card)),
    players: new Map(players.map((p) => [p.id, p])),
    winnerIds: [],
  }) as LiveGame;

describe('mapping cards back to cells', () => {
  it('finds the cells whose card has been Called', () => {
    const p = player('ana');
    expect([...calledCells(p, game([0, 5, 9], [p]))].sort((a, b) => a - b)).toEqual([0, 5, 9]);
  });

  it('finds the cells the Player has Marked', () => {
    expect([...markedCells(player('ana', [2, 3]))].sort((a, b) => a - b)).toEqual([2, 3]);
  });

  it('maps by card, not by position, so two Boards holding the same card differ', () => {
    // Boards are shuffled independently: cell 0 on Ana's board is a different
    // card from cell 0 on Beto's, so a Call cannot be a shared cell index.
    const beto: LivePlayer = { ...player('beto'), boardCardIds: [...board].reverse() };
    const g = game([0], [beto]);
    // card-0 sits at cell 15 once the board is reversed.
    expect([...calledCells(beto, g)]).toEqual([15]);
  });
});

describe('the one-away feed', () => {
  it('lists a Player three quarters through a row', () => {
    const ana = player('ana');
    expect(oneAwayPlayerIds(game([0, 1, 2], [ana]))).toEqual(['ana']);
  });

  it('lists a Player who has marked nothing at all', () => {
    // The feed measures the Board's luck, not the Player's attention. Someone
    // who has not touched their phone is still one Call from winning.
    const idle = player('idle', []);
    expect(oneAwayPlayerIds(game([0, 1, 2], [idle]))).toEqual(['idle']);
  });

  it('does not list a Player whose row is already complete', () => {
    const ana = player('ana');
    expect(oneAwayPlayerIds(game([0, 1, 2, 3], [ana]))).toEqual([]);
  });

  it('lists only the Players who qualify', () => {
    const close = player('close');
    const far: LivePlayer = { ...player('far'), boardCardIds: [...board].reverse() };
    // Calls 0,1,2 fill close's first row; on the reversed board they are cells
    // 15,14,13 — the last row, also three of four. Both qualify, which is the
    // point: this must be computed per Board, never once for the Game.
    expect(oneAwayPlayerIds(game([0, 1, 2], [close, far])).sort()).toEqual(['close', 'far']);
  });
});
