import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('password reset', () => {
  test('sign in page links to the reset request page', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/(en\/)?forgot-password/);
  });

  test('requesting a reset for an unknown address shows a generic confirmation', async ({
    page,
  }) => {
    await page.goto('/forgot-password');
    await page.locator('#email').fill('definitely-not-a-user@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });
    // The confirmation must not reveal whether the account exists.
    await expect(page.getByText(/definitely-not-a-user@example.com/)).toBeVisible();
    await expect(page.getByText(/no account|not found|doesn’t exist/i)).toHaveCount(0);
  });

  test('reset page with no token offers a way to request a new link', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText(/this link has expired/i)).toBeVisible();
    await page.getByRole('link', { name: /request a new link/i }).click();
    await expect(page).toHaveURL(/\/(en\/)?forgot-password/);
  });

  test('reset page shows the expired state when the callback reports a bad token', async ({
    page,
  }) => {
    await page.goto('/reset-password?error=INVALID_TOKEN');
    await expect(page.getByText(/this link has expired/i)).toBeVisible();
    await expect(page.locator('#password')).toHaveCount(0);
  });

  test('reset form validates length and confirmation before submitting', async ({ page }) => {
    await page.goto('/reset-password?token=not-a-real-token');
    await page.locator('#password').fill('short');
    await page.locator('#confirmPassword').fill('short');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();

    await page.locator('#password').fill('longenough123');
    await page.locator('#confirmPassword').fill('different123');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/passwords don’t match/i)).toBeVisible();
  });

  test('Spanish reset request page renders', async ({ page }) => {
    await page.goto('/es/forgot-password');
    await expect(page.getByRole('button', { name: /enviar enlace/i })).toBeVisible();
  });
});
