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

  test('an old dashboard link creates the first board and opens it', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /switch board:/i })).toBeVisible();
  });

  test('user can create another board from the editor picker', async ({ page }) => {
    await page.goto('/start');
    await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+/);
    const original = page.url();
    await page.getByRole('button', { name: /switch board:/i }).click();
    await page.getByRole('menuitem', { name: /^new board$/i }).click();
    await expect(page).not.toHaveURL(original);
    await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+/);
    await expect(page.getByRole('button', { name: /switch board:/i })).toBeVisible();
  });
});
