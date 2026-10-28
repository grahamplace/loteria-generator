import { describe, it, expect } from 'vitest';
import {
  parseSheetExtraction,
  normalizeTitle,
  computeSheetSlots,
  selectSheetCards,
  boxToRegion,
  withSheetOverlay,
  SHEET_CARD_OVERLAY,
  type SheetCard,
} from '@/lib/sheet-split';

const box = { x0: 0.1, y0: 0.1, x1: 0.4, y1: 0.4 };
const card = (row: number, col: number, title: string | null, complete = true, b = box) => ({
  row,
  col,
  title,
  complete,
  box: b,
});
const raw = (cards: unknown[]) => JSON.stringify({ rows: 2, cols: 2, cards });
const sc = (title: string | null, row = 1, col = 1): SheetCard => card(row, col, title);

describe('parseSheetExtraction', () => {
  it('drops incomplete cards', () => {
    const r = parseSheetExtraction(raw([card(1, 1, 'A'), card(1, 2, 'B', false), card(2, 1, 'C')]));
    expect(r?.cards).toHaveLength(2);
  });

  it('sorts reading order', () => {
    const r = parseSheetExtraction(raw([card(2, 1, 'c'), card(1, 2, 'b'), card(1, 1, 'a')]));
    expect(r?.cards.map((c) => [c.row, c.col])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });

  it('clamps and drops degenerate boxes', () => {
    const r = parseSheetExtraction(
      raw([
        card(1, 1, 'a', true, { x0: -0.1, y0: 0.2, x1: 0.3, y1: 1.4 }),
        card(1, 2, 'b', true, { x0: 0.5, y0: 0.2, x1: 0.4, y1: 0.6 }),
      ])
    );
    expect(r?.cards).toHaveLength(1);
    expect(r?.cards[0].box).toEqual({ x0: 0, y0: 0.2, x1: 0.3, y1: 1 });
  });

  it('trims titles and maps empty to null', () => {
    const r = parseSheetExtraction(raw([card(1, 1, '  La Luna '), card(1, 2, '   ')]));
    expect(r?.cards.map((c) => c.title)).toEqual(['La Luna', null]);
  });

  it('returns null on invalid JSON', () => {
    expect(parseSheetExtraction('not json')).toBeNull();
  });

  it('returns null on missing cards', () => {
    expect(parseSheetExtraction(JSON.stringify({ rows: 1, cols: 1 }))).toBeNull();
  });
});

describe('normalizeTitle', () => {
  it('strips accents, case and extra whitespace', () => {
    expect(normalizeTitle('  La  Evaluación ')).toBe('la evaluacion');
  });
});

describe('computeSheetSlots', () => {
  const base = {
    cardLimit: 4,
    currentCardCount: 1,
    generationLimit: 4,
    imageGenerationsUsed: 0,
    isAdmin: false,
  };
  it('locked empty board', () => expect(computeSheetSlots(base)).toBe(4));
  it('locked with 2 others', () =>
    expect(computeSheetSlots({ ...base, currentCardCount: 3 })).toBe(2));
  it('generations nearly used', () =>
    expect(computeSheetSlots({ ...base, imageGenerationsUsed: 3 })).toBe(1));
  it('unlocked board', () =>
    expect(
      computeSheetSlots({ ...base, cardLimit: 54, currentCardCount: 21, generationLimit: 100 })
    ).toBe(34));
  it('admin ignores generation limit', () =>
    expect(computeSheetSlots({ ...base, isAdmin: true, imageGenerationsUsed: 4 })).toBe(4));
  it('never negative', () => {
    expect(computeSheetSlots({ ...base, currentCardCount: 10 })).toBe(0);
    expect(computeSheetSlots({ ...base, imageGenerationsUsed: 9 })).toBe(0);
  });
});

describe('selectSheetCards', () => {
  const cards = [sc('El Apoyo'), sc('LA EVALUACIÓN'), sc('LA EVALUACIÓN'), sc(null)];
  it('skips existing labels only, keeps repeats and untitled', () => {
    const r = selectSheetCards(cards, ['EL APOYO'], 10);
    expect(r.skippedCount).toBe(1);
    expect(r.selected.map((c) => c.title)).toEqual(['LA EVALUACIÓN', 'LA EVALUACIÓN', null]);
  });
  it('limits to slots', () => {
    const r = selectSheetCards(cards, ['EL APOYO'], 2);
    expect(r.selected).toHaveLength(2);
    expect(r.skippedCount).toBe(1);
  });
});

describe('boxToRegion', () => {
  it('converts to pixels', () => {
    expect(boxToRegion({ x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.5 }, 1000, 800)).toEqual({
      left: 100,
      top: 80,
      width: 400,
      height: 320,
    });
  });
  it('returns null for tiny boxes', () => {
    expect(boxToRegion({ x0: 0.1, y0: 0.1, x1: 0.102, y1: 0.5 }, 1000, 800)).toBeNull();
  });
});

describe('withSheetOverlay', () => {
  it('combines with admin overlay', () => {
    const r = withSheetOverlay(true, 'make it blue');
    expect(r).toContain(SHEET_CARD_OVERLAY);
    expect(r).toContain('make it blue');
  });
  it('returns overlay alone', () => expect(withSheetOverlay(true)).toBe(SHEET_CARD_OVERLAY));
  it('null when not from sheet', () => {
    expect(withSheetOverlay(false, null)).toBeNull();
    expect(withSheetOverlay(false, 'x')).toBe('x');
  });
});
