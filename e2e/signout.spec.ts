import { test, expect } from '@playwright/test';

// Sign out a session of our own. Signing out the shared storageState session
// would revoke it server-side and log out every spec that runs afterwards.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('sign out', () => {
  test('sign out button signs out a logged in user', async ({ page }) => {
    const password = process.env.E2E_TEST_PASSWORD;
    if (!password) throw new Error('E2E_TEST_PASSWORD required');
    const res = await page.request.post('/api/auth/sign-in/email', {
      data: { email: 'e2etest@example.com', password },
    });
    expect(res.ok()).toBe(true);

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
