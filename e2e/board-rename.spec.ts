import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { boards } from '@/db/schema';
import { db } from './helpers/db';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('board rename', () => {
  let userId: string;
  let boardId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    const board = await seedBoard({ userId, name: 'Original Name', isUnlocked: true });
    boardId = board.id;
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('user can rename a board and the change persists', async ({ page }) => {
    await page.goto(`/boards/${boardId}`);

    // Click the board name to open the rename input.
    await page.getByRole('button', { name: /edit board name.*Original Name/i }).click();

    const renameInput = page.getByRole('textbox', { name: /rename board/i });
    await renameInput.fill('Renamed Board');
    await renameInput.press('Enter');

    // The visible name should update.
    await expect(page.getByRole('button', { name: /edit board name.*Renamed Board/i })).toBeVisible({ timeout: 5_000 });

    // Reload and confirm persistence.
    await page.reload();
    await expect(page.getByRole('button', { name: /edit board name.*Renamed Board/i })).toBeVisible({ timeout: 10_000 });

    const [row] = await db.select({ name: boards.name }).from(boards).where(eq(boards.id, boardId));
    expect(row.name).toBe('Renamed Board');
  });
});
