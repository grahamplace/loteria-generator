import { test, expect } from '@playwright/test';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';
import { seedCards } from './helpers/seed-cards';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('free tier limit', () => {
  let userId: string;
  let boardId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    const board = await seedBoard({ userId, name: 'Free Tier Board', isUnlocked: false });
    boardId = board.id;
    await seedCards({ boardId, userId, count: 4, status: 'completed' });
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('a free board at 4/4 shows the inline unlock CTA and opens the prompt', async ({ page }) => {
    await page.goto(`/boards/${boardId}`);

    // Wait for the board to render with all 4 seeded cards.
    await expect(page.getByText('4/4').first()).toBeVisible({ timeout: 10_000 });

    // The inline unlock tile renders automatically when atCardLimit && isLocked.
    // It contains a $5 badge and an "Unlock" CTA button.
    await expect(page.getByText('$5').first()).toBeVisible({ timeout: 5_000 });

    // Clicking the inline Unlock button opens the full unlock prompt modal.
    await page.getByRole('button', { name: /unlock/i }).first().click();

    // The modal renders with its own $5 CTA.
    await expect(page.getByText(/\$5/).first()).toBeVisible();
  });
});
