import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { cards } from '@/db/schema';
import { db } from './helpers/db';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';
import { seedCards } from './helpers/seed-cards';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('card delete', () => {
  let userId: string;
  let boardId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    const board = await seedBoard({ userId, name: 'Delete Card Test', isUnlocked: true });
    boardId = board.id;
    await seedCards({ boardId, userId, count: 2 });
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('deleting a card removes it from the board and DB', async ({ page }) => {
    await page.goto(`/boards/${boardId}`);

    // Open the first card.
    await page.getByText('Card 1').first().click();

    // Click delete in the modal — use exact text to avoid matching the board title edit button
    // (which has aria-label "Edit board name: Delete Card Test").
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    // Confirm in the AlertDialog (NOT a window.confirm — it's a custom dialog).
    // Start waiting for the DELETE API response before clicking confirm.
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/api/boards/') && res.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: /^(yes,?\s*)?delete/i }).last().click();
    await deleteResponse;

    // Card 1 should disappear; Card 2 remains.
    await expect(page.getByText('Card 1')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByText('Card 2')).toBeVisible();

    const rows = await db.select().from(cards).where(eq(cards.boardId, boardId));
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Card 2');
  });
});
