import { test, expect } from '@playwright/test';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';
import { seedCards } from './helpers/seed-cards';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('board export (unlocked)', () => {
  let userId: string;
  let boardId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    const board = await seedBoard({ userId, name: 'Export Test', isUnlocked: true });
    boardId = board.id;
    await seedCards({ boardId, userId, count: 16, status: 'completed' });
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('unlocked board with 16 cards exports a PDF, twice', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`/boards/${boardId}`);

    // Wait for the card grid to render.
    await expect(page.getByText('16/54').first()).toBeVisible({ timeout: 10_000 });

    // First export.
    const downloadPromise1 = page.waitForEvent('download', { timeout: 30_000 });
    await page
      .getByRole('button', { name: /^export/i })
      .first()
      .click();
    const download1 = await downloadPromise1;
    expect(download1.suggestedFilename()).toMatch(/loteria-set\.pdf$/);

    // Second export should also succeed (unlocked = unlimited).
    const downloadPromise2 = page.waitForEvent('download', { timeout: 30_000 });
    await page
      .getByRole('button', { name: /^export/i })
      .first()
      .click();
    const download2 = await downloadPromise2;
    expect(download2.suggestedFilename()).toMatch(/loteria-set\.pdf$/);
  });
});
