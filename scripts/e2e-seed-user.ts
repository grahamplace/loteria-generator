#!/usr/bin/env tsx
/**
 * Idempotently seeds the E2E test user via better-auth's signUp API.
 * Reads DATABASE_URL from process.env (set by the orchestrator).
 * Reads E2E_TEST_PASSWORD from process.env.
 */

import { auth } from '@/lib/auth';
import { GENERIC_SIGN_UP_ERROR_CODE } from '@/lib/signup-enumeration-guard';

const TEST_EMAIL = 'e2etest@example.com';
const TEST_NAME = 'E2E Test';

async function main(): Promise<void> {
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password) throw new Error('Missing E2E_TEST_PASSWORD');

  try {
    await auth.api.signUpEmail({
      body: { email: TEST_EMAIL, password, name: TEST_NAME },
    });
    process.stderr.write(`seeded ${TEST_EMAIL}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // lib/signup-enumeration-guard.ts intercepts direct auth.api.signUpEmail
    // calls (hooks.before is global, not HTTP-endpoint-specific) and replaces
    // better-auth's own "already exists" prose with GENERIC_SIGN_UP_ERROR_CODE
    // before this script ever sees it. Match the code first; keep the prose
    // patterns as a fallback for a better-auth upgrade that changes the code,
    // or for a run against a build that predates the guard.
    const code = (err as { body?: { code?: string } })?.body?.code;
    if (
      code === GENERIC_SIGN_UP_ERROR_CODE ||
      /already exists|USER_EXISTS|already registered/i.test(message)
    ) {
      process.stderr.write(`${TEST_EMAIL} already exists — ok\n`);
      return;
    }
    throw err;
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
