import { test, expect } from '@playwright/test';

test.describe('sign out', () => {
  test('sign out button signs out a logged in user', async ({ page }) => {
    // Saved dashboard links go directly into the editor.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+/);

    await page.getByRole('button', { name: /open user menu/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();

    // Redirected to landing.
    await expect(page).toHaveURL(/\/(en\/?)?$/);

    // Session is invalidated — visiting /dashboard now redirects.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
