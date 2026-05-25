import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  shouldIncludeCallerSheet,
  buildCallerSheetEntries,
  addCallerSheetPages,
  type CallerSheetEntry,
} from '@/lib/caller-sheet';
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

describe('addCallerSheetPages', () => {
  const newPdf = () => new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

  it('adds no pages when entries is empty', () => {
    const pdf = newPdf();
    const before = pdf.getNumberOfPages();
    addCallerSheetPages(pdf, [], { title: 'Caller Sheet' });
    expect(pdf.getNumberOfPages()).toBe(before);
  });

  it('adds exactly one page for a few short entries', () => {
    const pdf = newPdf();
    const before = pdf.getNumberOfPages();
    const entries: CallerSheetEntry[] = [
      { number: 1, label: 'El Gallo', riddle: 'Canta al amanecer.' },
      { number: 2, label: 'La Dama', riddle: null },
      { number: 3, label: 'El Catrín', riddle: 'Bien vestido.' },
    ];
    addCallerSheetPages(pdf, entries, { title: 'Caller Sheet' });
    expect(pdf.getNumberOfPages()).toBe(before + 1);
  });

  it('paginates many long entries across multiple pages', () => {
    const pdf = newPdf();
    const before = pdf.getNumberOfPages();
    const longRiddle = 'Lorem ipsum dolor sit amet '.repeat(8).trim(); // ~200 chars
    const entries: CallerSheetEntry[] = Array.from({ length: 40 }, (_, i) => ({
      number: i + 1,
      label: `Carta ${i + 1}`,
      riddle: longRiddle,
    }));
    addCallerSheetPages(pdf, entries, { title: 'Caller Sheet' });
    expect(pdf.getNumberOfPages() - before).toBeGreaterThanOrEqual(2);
  });
});
