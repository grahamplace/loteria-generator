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

    // `^unlock ·` matches the inline tile button only ("Unlock · $20"), not the
    // header button ("Unlock for $20") that's always visible while locked. The
    // mobile footer button shares the tile's label but is hidden on desktop.
    const inlineUnlock = page.getByRole('button', { name: /^unlock ·/i });
    await expect(inlineUnlock).toBeVisible({ timeout: 5_000 });

    // Modal dialog isn't in the DOM until clicked.
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await inlineUnlock.click();

    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
