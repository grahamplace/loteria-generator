import { describe, it, expect } from 'vitest';
import { generateBoards, clampBoardCount } from '@/lib/generate-boards';
import {
  DEFAULT_EXPORT_BOARD_COUNT,
  MIN_EXPORT_BOARD_COUNT,
  MAX_EXPORT_BOARD_COUNT,
} from '@/lib/constants';

// Mock card data
const createMockCards = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `card-${i + 1}`,
    number: i + 1,
    label: `Card ${i + 1}`,
    illustration: `data:image/png;base64,mock${i}`,
  }));
};

describe('generateBoards', () => {
  it('should generate the default number of boards when given enough cards', () => {
    const cards = createMockCards(20);
    const boards = generateBoards(cards);

    expect(boards).toHaveLength(DEFAULT_EXPORT_BOARD_COUNT);
  });

  it('should generate boards with 16 cards each', () => {
    const cards = createMockCards(20);
    const boards = generateBoards(cards);

    boards.forEach((board) => {
      expect(board).toHaveLength(16);
    });
  });

  it('should throw error when fewer than 16 cards provided', () => {
    const cards = createMockCards(15);

    expect(() => generateBoards(cards)).toThrow();
  });

  it('should include cards from the input in the output', () => {
    const cards = createMockCards(20);
    const boards = generateBoards(cards);

    // Check that all cards in boards are from the input
    boards.forEach((board) => {
      board.forEach((card) => {
        const found = cards.find((c) => c.id === card.id);
        expect(found).toBeDefined();
      });
    });
  });

  it('should generate different boards (shuffled)', () => {
    const cards = createMockCards(54);
    const boards = generateBoards(cards);

    // Check that boards are not identical
    const board1Ids = boards[0].map((c) => c.id).join(',');

    // They should be different (shuffled) - though there's a tiny chance they could be the same
    // We check at least one pair is different
    const allSame = boards.every(
      (board, i) => i === 0 || board.map((c) => c.id).join(',') === board1Ids
    );
    expect(allSame).toBe(false);
  });

  it('should work with exactly 16 cards', () => {
    const cards = createMockCards(16);
    const boards = generateBoards(cards);

    expect(boards).toHaveLength(DEFAULT_EXPORT_BOARD_COUNT);
    boards.forEach((board) => {
      expect(board).toHaveLength(16);
    });
  });

  it('should honor an explicit board count', () => {
    const cards = createMockCards(20);

    expect(generateBoards(cards, 7)).toHaveLength(7);
    expect(generateBoards(cards, MAX_EXPORT_BOARD_COUNT)).toHaveLength(MAX_EXPORT_BOARD_COUNT);
  });

  it('should clamp an out-of-range board count', () => {
    const cards = createMockCards(20);

    expect(generateBoards(cards, 500)).toHaveLength(MAX_EXPORT_BOARD_COUNT);
    expect(generateBoards(cards, 0)).toHaveLength(MIN_EXPORT_BOARD_COUNT);
  });
});

describe('clampBoardCount', () => {
  it('should clamp values below the minimum', () => {
    expect(clampBoardCount(0)).toBe(MIN_EXPORT_BOARD_COUNT);
    expect(clampBoardCount(-5)).toBe(MIN_EXPORT_BOARD_COUNT);
  });

  it('should clamp values above the maximum', () => {
    expect(clampBoardCount(MAX_EXPORT_BOARD_COUNT + 1)).toBe(MAX_EXPORT_BOARD_COUNT);
    expect(clampBoardCount(1000)).toBe(MAX_EXPORT_BOARD_COUNT);
  });

  it('should floor non-integer values', () => {
    expect(clampBoardCount(DEFAULT_EXPORT_BOARD_COUNT + 0.7)).toBe(DEFAULT_EXPORT_BOARD_COUNT);
    expect(clampBoardCount(3.2)).toBe(3);
  });

  it('should fall back to the default for NaN', () => {
    expect(clampBoardCount(NaN)).toBe(DEFAULT_EXPORT_BOARD_COUNT);
  });

  it('should fall back to the default for Infinity', () => {
    expect(clampBoardCount(Infinity)).toBe(DEFAULT_EXPORT_BOARD_COUNT);
    expect(clampBoardCount(-Infinity)).toBe(DEFAULT_EXPORT_BOARD_COUNT);
  });

  it('should pass through in-range values unchanged', () => {
    expect(clampBoardCount(DEFAULT_EXPORT_BOARD_COUNT)).toBe(DEFAULT_EXPORT_BOARD_COUNT);
    expect(clampBoardCount(12)).toBe(12);
  });
});
