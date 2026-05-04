import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { boards } from '@/db/schema';
import { db } from './helpers/db';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';
import { seedCards } from './helpers/seed-cards';
import { unlockBoardViaWebhook } from './helpers/stripe-webhook';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('board unlock via webhook', () => {
  let userId: string;
  let boardId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    const board = await seedBoard({ userId, name: 'Unlock Test', isUnlocked: false });
    boardId = board.id;
    await seedCards({ boardId, userId, count: 4, status: 'completed' });
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('signed checkout.session.completed webhook unlocks the board', async ({ page, request }) => {
    await page.goto(`/boards/${boardId}`);
    await expect(page.getByText('4/4').first()).toBeVisible({ timeout: 10_000 });

    await unlockBoardViaWebhook(request, { boardId, userId });

    // DB-level assertion.
    const [row] = await db
      .select({ isUnlocked: boards.isUnlocked })
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);
    expect(row.isUnlocked).toBe(true);

    // UI-level assertion after reload (no realtime; reload is realistic post-Stripe behavior).
    await page.reload();
    await expect(page.getByText('4/54').first()).toBeVisible({ timeout: 10_000 });
  });
});
