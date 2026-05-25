import { describe, it, expect } from 'vitest';
import { shouldIncludeCallerSheet, buildCallerSheetEntries } from '@/lib/caller-sheet';
import type { LotteriaCard } from '@/lib/generate-boards';

const card = (over: Partial<LotteriaCard> & { number: number }): LotteriaCard => ({
  id: `card-${over.number}`,
  label: `Card ${over.number}`,
  illustration: 'data:image/png;base64,x',
  ...over,
});

describe('shouldIncludeCallerSheet', () => {
  it('is false when no card has a riddle', () => {
    expect(shouldIncludeCallerSheet([card({ number: 1 }), card({ number: 2 })])).toBe(false);
  });

  it('is false when riddles are only whitespace', () => {
    expect(shouldIncludeCallerSheet([card({ number: 1, riddle: '   ' })])).toBe(false);
  });

  it('is true when at least one card has a non-empty riddle', () => {
    expect(
      shouldIncludeCallerSheet([card({ number: 1 }), card({ number: 2, riddle: 'Pista' })])
    ).toBe(true);
  });
});

describe('buildCallerSheetEntries', () => {
  it('sorts entries by card number', () => {
    const entries = buildCallerSheetEntries([
      card({ number: 3 }),
      card({ number: 1 }),
      card({ number: 2 }),
    ]);
    expect(entries.map((e) => e.number)).toEqual([1, 2, 3]);
  });

  it('excludes processing and errored cards', () => {
    const entries = buildCallerSheetEntries([
      card({ number: 1 }),
      card({ number: 2, isProcessing: true }),
      card({ number: 3, error: 'boom' }),
    ]);
    expect(entries.map((e) => e.number)).toEqual([1]);
  });

  it('includes cards without a riddle (riddle null) and trims riddles', () => {
    const entries = buildCallerSheetEntries([
      card({ number: 1 }),
      card({ number: 2, riddle: '  Pista corta  ' }),
    ]);
    expect(entries[0].riddle).toBeNull();
    expect(entries[1].riddle).toBe('Pista corta');
  });
});
