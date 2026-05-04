import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('sign in', () => {
  test('seeded user can sign in and reach dashboard', async ({ page }) => {
    const password = process.env.E2E_TEST_PASSWORD;
    if (!password) throw new Error('E2E_TEST_PASSWORD required');

    await page.goto('/sign-in');
    await page.locator('#email').fill('e2etest@example.com');
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page).toHaveURL(/\/(en\/)?dashboard/, { timeout: 10_000 });
  });
});
