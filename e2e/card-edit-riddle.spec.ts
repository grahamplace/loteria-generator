import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { cards } from '@/db/schema';
import { db } from './helpers/db';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';
import { seedCards } from './helpers/seed-cards';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('card edit riddle', () => {
  let userId: string;
  let boardId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    const board = await seedBoard({ userId, name: 'Edit Riddle Test', isUnlocked: true });
    boardId = board.id;
    await seedCards({ boardId, userId, count: 1 });
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('editing a card riddle persists across reload', async ({ page }) => {
    await page.goto(`/boards/${boardId}`);

    // Open the card editor by clicking the seeded "Card 1" tile.
    await page.getByText('Card 1').first().click();

    const riddleInput = page.getByRole('textbox', { name: /card riddle/i });
    await expect(riddleInput).toBeVisible({ timeout: 5_000 });
    await riddleInput.fill('El que le cantó a San Pedro');

    // PATCH is fire-and-forget after the optimistic update — wait for it.
    const patchResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/boards/${boardId}/cards`) && res.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: /save/i }).click();
    await patchResponse;

    // Persistence check via DB after reload.
    await page.reload();
    await expect(page.getByText('Card 1').first()).toBeVisible({ timeout: 10_000 });

    const rows = await db
      .select({ riddle: cards.riddle })
      .from(cards)
      .where(eq(cards.boardId, boardId));
    expect(rows[0].riddle).toBe('El que le cantó a San Pedro');
  });
});
