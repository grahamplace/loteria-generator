import { test as setup, expect } from '@playwright/test';
import { ONBOARDING_STORAGE_KEY } from '@/lib/onboarding/state';

const STORAGE_STATE = 'e2e/setup/storage-state.json';
const TEST_EMAIL = 'e2etest@example.com';

setup('authenticate', async ({ page }) => {
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password) {
    throw new Error('E2E_TEST_PASSWORD is required');
  }

  // Use page.request (not the standalone `request` fixture) so the
  // response Set-Cookie headers land in page.context()'s cookie jar —
  // which is what we serialize to storageState below.
  const res = await page.request.post('/api/auth/sign-in/email', {
    data: { email: TEST_EMAIL, password },
  });

  expect(res.ok(), `sign-in failed: ${res.status()} ${await res.text()}`).toBe(true);

  // Mark the first-run onboarding as already finished for the seeded user.
  // The coachmarks auto-start on an empty dashboard/board and smooth-scroll the
  // page as they mount, which shifts CTAs out from under in-flight clicks. The
  // new-user tour path is exercised by signup.spec.ts, which starts from a
  // clean storage state.
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({ status: 'completed' }));
  }, ONBOARDING_STORAGE_KEY);

  await page.context().storageState({ path: STORAGE_STATE });
});
