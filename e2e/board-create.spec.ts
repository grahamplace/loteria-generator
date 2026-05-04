import { test, expect } from '@playwright/test';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('board create', () => {
  test.beforeEach(async () => {
    const userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
  });

  test.afterEach(async () => {
    const userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
  });

  test('user can create their first board from an empty dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/(en\/)?dashboard/);

    await page
      .getByRole('button', { name: /new board/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/(en\/)?boards\/[0-9a-f-]+/, { timeout: 10_000 });
  });
});
