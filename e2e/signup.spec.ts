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

  test('new user can sign up with email and lands on dashboard', async ({ page }) => {
    const email = `signup-${Date.now()}@example.com`;
    createdEmail = email;

    await page.goto('/sign-up');

    await page.locator('#name').fill('New E2E User');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('TestPassword123!');

    await page.getByRole('button', { name: /sign up|create account/i }).click();

    await expect(page).toHaveURL(/\/(en\/)?dashboard/, { timeout: 10_000 });
  });
});
