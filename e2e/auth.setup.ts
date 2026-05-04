import { test as setup, expect } from '@playwright/test';

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

  await page.context().storageState({ path: STORAGE_STATE });
});
