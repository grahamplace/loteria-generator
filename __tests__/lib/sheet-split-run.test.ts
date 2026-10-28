import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

const mocks = vi.hoisted(() => ({
  boardFind: vi.fn(),
  cardsFind: vi.fn(),
  updates: [] as { table: unknown; values: Record<string, unknown> }[],
  fetchBlob: vi.fn(),
  uploadOriginalImage: vi.fn(),
  uploadSheetImage: vi.fn(),
  insertCardsWithinLimit: vi.fn(),
  deleteCardAndRenumber: vi.fn(),
}));

vi.mock('@/db', () => {
  const boards = { id: 'boards.id', __t: 'boards' };
  const cards = { id: 'cards.id', boardId: 'cards.boardId', __t: 'cards' };
  return {
    boards,
    cards,
    getGenerationLimit: () => 100,
    db: {
      query: {
        boards: { findFirst: mocks.boardFind },
        cards: { findMany: mocks.cardsFind },
      },
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => {
          mocks.updates.push({ table, values });
          return { where: async () => undefined };
        },
      }),
    },
  };
});
vi.mock('@/lib/blob', () => ({
  fetchBlob: mocks.fetchBlob,
  uploadOriginalImage: mocks.uploadOriginalImage,
  uploadSheetImage: mocks.uploadSheetImage,
}));
vi.mock('@/lib/boards/add-cards', () => ({ insertCardsWithinLimit: mocks.insertCardsWithinLimit }));
vi.mock('@/lib/boards/delete-card', () => ({ deleteCardAndRenumber: mocks.deleteCardAndRenumber }));

import { splitSheetCard } from '@/lib/sheet-split-run';
import type { SheetCard } from '@/lib/sheet-split';

function sheetCard(i: number, title: string | null): SheetCard {
  const col = i % 5;
  const row = Math.floor(i / 5);
  return {
    row: row + 1,
    col: col + 1,
    title,
    complete: true,
    box: { x0: col * 0.2, y0: row * 0.2, x1: col * 0.2 + 0.18, y1: row * 0.2 + 0.18 },
  };
}
const extraction = (cards: SheetCard[]) => ({ rows: 5, cols: 5, cards });

const base = {
  cardId: 'c1',
  boardId: 'b1',
  userId: 'u1',
  isAdmin: false,
  originalImageUrl: 'blob://sheet',
};
const boardRow = (over = {}) => ({ id: 'b1', isUnlocked: false, imageGenerationsUsed: 0, ...over });
const existing = (n: number, labels: string[] = []) =>
  Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? 'c1' : `x${i}`,
    label: i === 0 ? '' : (labels[i - 1] ?? `L${i}`),
  }));

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.updates.length = 0;
  const png = await sharp({
    create: { width: 500, height: 500, channels: 3, background: '#cc3333' },
  })
    .png()
    .toBuffer();
  mocks.fetchBlob.mockResolvedValue({ buffer: png, contentType: 'image/png' });
  mocks.uploadOriginalImage.mockImplementation(async (_u, _b, id) => `blob://${id}/original.png`);
  mocks.uploadSheetImage.mockResolvedValue('blob://sheet-kept');
  mocks.boardFind.mockResolvedValue(boardRow());
  mocks.cardsFind.mockResolvedValue(existing(1));
  mocks.insertCardsWithinLimit.mockImplementation(async (_b, _u, rows: unknown[]) =>
    rows.map((_, i) => ({ id: `n${i}` }))
  );
});

describe('splitSheetCard', () => {
  it('locked empty board splits into 4', async () => {
    const cardsIn = Array.from({ length: 45 }, (_, i) => sheetCard(i % 25, `T${i}`));
    const r = await splitSheetCard({ ...base, extraction: extraction(cardsIn) });
    expect(r.status).toBe('split');
    if (r.status !== 'split') return;
    expect(r.createdCount).toBe(4);
    expect(r.foundCount).toBe(45);
    expect(r.others).toHaveLength(3);
    const rows = mocks.insertCardsWithinLimit.mock.calls[0][2];
    expect(rows).toHaveLength(3);
    expect(
      rows.every(
        (x: { fromSheet: boolean; status: string }) => x.fromSheet && x.status === 'processing'
      )
    ).toBe(true);
    expect(mocks.updates.some((u) => u.values.sheetCardsFound === 45)).toBe(true);
    expect(mocks.updates.find((u) => u.values.fromSheet === true)).toBeTruthy();
    expect(mocks.uploadSheetImage).toHaveBeenCalledTimes(1);
  });

  it('titles become labels', async () => {
    const r = await splitSheetCard({
      ...base,
      extraction: extraction([sheetCard(0, 'LOS NIÑOS'), sheetCard(1, null)]),
    });
    if (r.status !== 'split') throw new Error('expected split');
    expect(mocks.updates[0].values).toMatchObject({ label: 'LOS NIÑOS', fromSheet: true });
    expect(r.first.titled).toBe(true);
    expect(mocks.insertCardsWithinLimit.mock.calls[0][2][0].label).toBe('');
    expect(r.others[0].titled).toBe(false);
  });

  it('keeps the existing label when card 1 has no title', async () => {
    await splitSheetCard({
      ...base,
      extraction: extraction([sheetCard(0, null), sheetCard(1, 'X')]),
    });
    expect(mocks.updates[0].values).not.toHaveProperty('label');
  });

  it('skips cards already on board', async () => {
    mocks.cardsFind.mockResolvedValue(existing(2, ['Los Niños']));
    const r = await splitSheetCard({
      ...base,
      extraction: extraction([
        sheetCard(0, 'LOS NIÑOS'),
        sheetCard(1, 'EL SOL'),
        sheetCard(2, 'LA LUNA'),
      ]),
    });
    if (r.status !== 'split') throw new Error('expected split');
    expect(r.skippedCount).toBe(1);
    expect(r.first.titled).toBe(true);
    expect(mocks.updates[0].values.label).toBe('EL SOL');
  });

  it('all duplicates deletes the uploaded card', async () => {
    mocks.cardsFind.mockResolvedValue(existing(2, ['El Sol']));
    const r = await splitSheetCard({ ...base, extraction: extraction([sheetCard(0, 'EL SOL')]) });
    expect(r).toEqual({ status: 'all-duplicates', foundCount: 1, skippedCount: 1 });
    expect(mocks.deleteCardAndRenumber).toHaveBeenCalledWith('b1', 'c1', 'u1');
    expect(mocks.uploadSheetImage).not.toHaveBeenCalled();
  });

  it('returns no-slots when the board is full', async () => {
    mocks.cardsFind.mockResolvedValue(existing(5));
    mocks.boardFind.mockResolvedValue(boardRow({ imageGenerationsUsed: 100 }));
    const r = await splitSheetCard({
      ...base,
      extraction: extraction([sheetCard(0, 'A'), sheetCard(1, 'B')]),
    });
    expect(r).toEqual({ status: 'no-slots' });
    expect(mocks.uploadSheetImage).not.toHaveBeenCalled();
  });

  it('retries insert with smaller count', async () => {
    // 4 selected on empty locked board -> insert 3. Then another upload takes a slot.
    mocks.insertCardsWithinLimit
      .mockResolvedValueOnce([])
      .mockImplementationOnce(async (_b, _u, rows: unknown[]) =>
        rows.map((_, i) => ({ id: `r${i}` }))
      );
    mocks.cardsFind.mockResolvedValueOnce(existing(1)).mockResolvedValueOnce(existing(2));
    const cardsIn = Array.from({ length: 10 }, (_, i) => sheetCard(i, `T${i}`));
    const r = await splitSheetCard({ ...base, extraction: extraction(cardsIn) });
    expect(mocks.insertCardsWithinLimit).toHaveBeenCalledTimes(2);
    expect(mocks.insertCardsWithinLimit.mock.calls[0][2]).toHaveLength(3);
    expect(mocks.insertCardsWithinLimit.mock.calls[1][2]).toHaveLength(2);
    if (r.status !== 'split') throw new Error('expected split');
    expect(r.createdCount).toBe(3);
  });
});
