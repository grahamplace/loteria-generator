import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Regression guard for a build failure, not a runtime one.
 *
 * `next build` evaluates every route module while collecting page data. Both
 * neon() and the Stripe constructor throw when their secret is missing, so
 * constructing either at module scope fails the whole build on any environment
 * without that secret — which is exactly how Vercel preview deploys broke.
 *
 * These modules must therefore import cleanly with no secrets present. If this
 * test starts failing, a client has been moved back to module scope.
 */
describe('modules import cleanly without secrets', () => {
  const SECRETS = ['DATABASE_URL', 'STRIPE_SECRET_KEY'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.resetModules();
    for (const key of SECRETS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of SECRETS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('should import the database module without DATABASE_URL', async () => {
    const mod = await import('@/db');

    expect(mod.db).toBeDefined();
    // Schema re-exports must still resolve; call sites import them alongside db.
    expect(mod.boards).toBeDefined();
  });

  it('should import the stripe module without STRIPE_SECRET_KEY', async () => {
    const mod = await import('@/lib/stripe');

    expect(mod.stripe).toBeDefined();
    expect(typeof mod.createBoardUnlockCheckout).toBe('function');
  });

  it('should fail with a message naming the variable once the client is used', async () => {
    const { stripe } = await import('@/lib/stripe');

    expect(() => stripe.checkout).toThrow('STRIPE_SECRET_KEY is not set');
  });
});
