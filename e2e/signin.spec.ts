import { test, expect } from '@playwright/test';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';

// Sign in from a clean slate — the shared storageState is already authenticated,
// which would short-circuit the whole flow.
test.use({ storageState: { cookies: [], origins: [] } });

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('sign in', () => {
  let userId: string;
  let boardId: string;

  // Start with a known board so the post-auth destination is deterministic.
  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    const board = await seedBoard({ userId, name: 'Only Board', isUnlocked: false });
    boardId = board.id;
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('seeded user with one board signs in and lands in that board', async ({ page }) => {
    const password = process.env.E2E_TEST_PASSWORD;
    if (!password) throw new Error('E2E_TEST_PASSWORD required');

    await page.goto('/sign-in');
    await page.locator('#email').fill(SEEDED_EMAIL);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // '/start' sees exactly one board and drops the user straight into it —
    // the empty-ish dashboard is skipped entirely.
    await expect(page).toHaveURL(new RegExp(`/(en/)?boards/${boardId}$`), { timeout: 15_000 });
  });
  test('multiple-board users resume their last-opened board, including through /dashboard', async ({
    page,
  }) => {
    const password = process.env.E2E_TEST_PASSWORD!;
    const second = await seedBoard({ userId, name: 'Second Board', isUnlocked: false });
    await page.goto('/sign-in');
    await page.locator('#email').fill(SEEDED_EMAIL);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(new RegExp(`/boards/${second.id}$`), { timeout: 15_000 });
    await page.getByRole('button', { name: /switch board:/i }).click();
    await page.getByRole('menuitem', { name: /Only Board/ }).click();
    await expect(page).toHaveURL(new RegExp(`/boards/${boardId}$`));
    await expect(page.getByRole('button', { name: /switch board: Only Board/i })).toBeVisible();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(new RegExp(`/boards/${boardId}$`));
    await page.goto('/es/start');
    await expect(page).toHaveURL(new RegExp(`/es/boards/${boardId}$`));
  });
});
