import { test, expect } from '@playwright/test';
import { deleteUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('sign up', () => {
  let createdEmail: string | null = null;

  test.afterEach(async () => {
    if (createdEmail) {
      try {
        const id = await getUserIdByEmail(createdEmail);
        await deleteUser(id);
      } catch {
        // user may not have been created on a failed test
      }
      createdEmail = null;
    }
  });

  test('new user can sign up with email and lands in their first board', async ({ page }) => {
    const email = `signup-${Date.now()}@example.com`;
    createdEmail = email;

    await page.goto('/sign-up');

    await page.locator('#name').fill('New E2E User');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('TestPassword123!');

    await page.getByRole('button', { name: /sign up|create account/i }).click();

    // Signup routes through /start, which auto-creates the user's first board
    // and drops them straight into it — the empty dashboard is skipped.
    await expect(page).toHaveURL(/\/(en\/)?boards\/[0-9a-f-]+/, { timeout: 15_000 });
  });
});
