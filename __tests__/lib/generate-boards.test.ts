import { describe, it, expect } from 'vitest';
import { generateBoards } from '@/lib/generate-boards';

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
  it('should generate 4 boards when given enough cards', () => {
    const cards = createMockCards(20);
    const boards = generateBoards(cards);

    expect(boards).toHaveLength(4);
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

    expect(boards).toHaveLength(4);
    boards.forEach((board) => {
      expect(board).toHaveLength(16);
    });
  });
});
