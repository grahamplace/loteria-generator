import { eq } from 'drizzle-orm';
import { boards, user } from '@/db/schema';
import { db } from './db';

export async function deleteBoardsForUser(userId: string): Promise<void> {
  // ON DELETE CASCADE on cards.board_id handles cards.
  await db.delete(boards).where(eq(boards.userId, userId));
}

export async function deleteUser(userId: string): Promise<void> {
  // ON DELETE CASCADE on boards.user_id handles boards (and cards transitively).
  await db.delete(user).where(eq(user.id, userId));
}
