import { boards } from '@/db/schema';
import { db } from './db';

export interface SeedBoardOpts {
  userId: string;
  name?: string;
  isUnlocked?: boolean;
}

export async function seedBoard(opts: SeedBoardOpts): Promise<{ id: string; name: string }> {
  const name = opts.name ?? `E2E Board ${Date.now()}`;
  const [row] = await db
    .insert(boards)
    .values({
      userId: opts.userId,
      name,
      isUnlocked: opts.isUnlocked ?? false,
    })
    .returning({ id: boards.id, name: boards.name });
  return row;
}
