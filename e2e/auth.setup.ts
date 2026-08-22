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
  // Navigate somewhere authenticated-but-inert purely to get a same-origin
  // document to write localStorage into. NOT '/': the landing page now
  // redirects a signed-in user to '/start', which auto-creates a board — this
  // setup step would silently seed a stray board for the test user on every
  // run and leave specs that assert on board counts flaky. '/faq' is public,
  // has no session-dependent redirect, and shares the baseURL origin so the
  // key lands where the app reads it.
  await page.goto('/faq');
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({ status: 'completed' }));
  }, ONBOARDING_STORAGE_KEY);

  await page.context().storageState({ path: STORAGE_STATE });
});
