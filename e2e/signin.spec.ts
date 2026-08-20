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

  // Pin the board count. Sign-in funnels through '/start', which routes by how
  // many boards the user has — with an unknown starting state this test would
  // sometimes land on '/boards/{id}' and sometimes on '/dashboard'.
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
});
