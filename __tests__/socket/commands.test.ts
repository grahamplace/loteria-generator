import { describe, it, expect } from 'vitest';
import { drawNextCall } from '@/socket/commands';
import type { LiveGame } from '@/socket/game-registry';

const deck = (n: number) => Array.from({ length: n }, (_, i) => `card-${i}`);

const game = (over: Partial<LiveGame> = {}): LiveGame =>
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
    version: 0,
    deckCardIds: deck(5),
    calls: [],
    calledSet: new Set<string>(),
    players: new Map(),
    winnerIds: [],
    ...over,
  }) as LiveGame;

/** Always picks the first remaining card, so assertions are exact. */
const first = () => 0;

describe('drawing a Call', () => {
  it('takes a card and records it in one synchronous step', () => {
    const g = game();
    const r = drawNextCall(g, first);
    expect(r).toEqual({ ok: true, cardId: 'card-0', sequence: 1, deckExhausted: false });
    // The claim on the slot must be visible immediately — this is the
    // arbitration. If it were deferred, a second message could take the same
    // card before the first finished.
    expect(g.calledSet.has('card-0')).toBe(true);
    expect(g.calls).toEqual(['card-0']);
  });

  it('never calls the same card twice', () => {
    const g = game();
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const r = drawNextCall(g, Math.random);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(seen.has(r.cardId)).toBe(false);
        seen.add(r.cardId);
      }
    }
    expect(seen.size).toBe(5);
  });

  it('numbers Calls from one, in order', () => {
    const g = game();
    expect([1, 2, 3].map(() => (drawNextCall(g, first) as { sequence: number }).sequence)).toEqual([
      1, 2, 3,
    ]);
  });

  it('flags the last card so the Game can end itself', () => {
    const g = game({ deckCardIds: deck(2) });
    expect((drawNextCall(g, first) as { deckExhausted: boolean }).deckExhausted).toBe(false);
    expect((drawNextCall(g, first) as { deckExhausted: boolean }).deckExhausted).toBe(true);
  });

  it('refuses once the Deck is empty', () => {
    const g = game({ deckCardIds: deck(1) });
    drawNextCall(g, first);
    expect(drawNextCall(g, first)).toEqual({ ok: false, reason: 'deck_exhausted' });
  });

  it('refuses while the Game is still in the lobby', () => {
    expect(drawNextCall(game({ status: 'lobby' }), first)).toEqual({
      ok: false,
      reason: 'not_playing',
    });
  });

  it('refuses once someone has won', () => {
    // Calls freeze the instant the first Win lands. A Call slipping through
    // would mean a Player claiming inside the Claim Window won against a
    // different board than the winner saw.
    const g = game({ winnerIds: ['ana'] });
    expect(drawNextCall(g, first)).toEqual({ ok: false, reason: 'claim_window_open' });
    expect(g.calls).toHaveLength(0);
  });

  it('leaves the Game untouched when it refuses', () => {
    const g = game({ status: 'ended' });
    drawNextCall(g, first);
    expect(g.calls).toHaveLength(0);
    expect(g.calledSet.size).toBe(0);
  });
});
