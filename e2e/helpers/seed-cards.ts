import { cards, type CardStatus } from '@/db/schema';
import { db } from './db';

export interface SeedCardsOpts {
  boardId: string;
  userId: string;
  count: number;
  status?: CardStatus;
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x600.png';

export async function seedCards(opts: SeedCardsOpts): Promise<void> {
  const status = opts.status ?? 'completed';
  const rows = Array.from({ length: opts.count }, (_, i) => ({
    boardId: opts.boardId,
    userId: opts.userId,
    number: i + 1,
    label: `Card ${i + 1}`,
    originalImageUrl: PLACEHOLDER_IMAGE,
    illustrationUrl: PLACEHOLDER_IMAGE,
    status,
  }));
  await db.insert(cards).values(rows);
}
