// __tests__/lib/unsubscribe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Configurable results for the two terminal operations in lib/email/unsubscribe.ts:
// `.limit()` ends select chains, `.returning()` ends insert/update chains.
const state = { limit: [] as unknown[], returning: [] as unknown[] };

vi.mock('@/db', () => {
  const chain: Record<string, unknown> = {};
  const ret = () => chain;
  for (const m of [
    'insert',
    'values',
    'onConflictDoUpdate',
    'select',
    'from',
    'where',
    'set',
    'update',
  ]) {
    chain[m] = vi.fn(ret);
  }
  chain.limit = vi.fn(async () => state.limit);
  chain.returning = vi.fn(async () => state.returning);
  return { db: chain, userProfiles: {} };
});

import {
  generateUnsubscribeToken,
  getOrCreateUnsubscribeToken,
  isMarketingUnsubscribed,
  unsubscribeByToken,
  resubscribeByToken,
  getUnsubscribeStateByToken,
} from '@/lib/email/unsubscribe';

beforeEach(() => {
  state.limit = [];
  state.returning = [];
});

describe('generateUnsubscribeToken', () => {
  it('is URL-safe and unique', () => {
    const a = generateUnsubscribeToken();
    const b = generateUnsubscribeToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(20);
    expect(a).not.toBe(b);
  });
});

describe('getOrCreateUnsubscribeToken', () => {
  it('returns the persisted token', async () => {
    state.returning = [{ token: 'existing-tok' }];
    expect(await getOrCreateUnsubscribeToken('u1')).toBe('existing-tok');
  });
});

describe('isMarketingUnsubscribed', () => {
  it('is false when no profile row exists', async () => {
    state.limit = [];
    expect(await isMarketingUnsubscribed('u1')).toBe(false);
  });
  it('is false when not opted out', async () => {
    state.limit = [{ unsubscribedAt: null }];
    expect(await isMarketingUnsubscribed('u1')).toBe(false);
  });
  it('is true when opted out', async () => {
    state.limit = [{ unsubscribedAt: new Date() }];
    expect(await isMarketingUnsubscribed('u1')).toBe(true);
  });
});

describe('unsubscribeByToken / resubscribeByToken', () => {
  it('returns ok with userId when the token matches', async () => {
    state.returning = [{ id: 'u1' }];
    expect(await unsubscribeByToken('tok')).toEqual({ ok: true, userId: 'u1' });
  });
  it('returns not-ok for an unknown token', async () => {
    state.returning = [];
    expect(await unsubscribeByToken('nope')).toEqual({ ok: false });
  });
  it('short-circuits an empty token without querying', async () => {
    expect(await unsubscribeByToken('')).toEqual({ ok: false });
    expect(await resubscribeByToken('')).toEqual({ ok: false });
  });
  it('re-subscribes a matching token', async () => {
    state.returning = [{ id: 'u1' }];
    expect(await resubscribeByToken('tok')).toEqual({ ok: true, userId: 'u1' });
  });
});

describe('getUnsubscribeStateByToken', () => {
  it('reports not found for an unknown token', async () => {
    state.limit = [];
    expect(await getUnsubscribeStateByToken('nope')).toEqual({ found: false, unsubscribed: false });
  });
  it('reports subscribed when the row has no opt-out timestamp', async () => {
    state.limit = [{ unsubscribedAt: null }];
    expect(await getUnsubscribeStateByToken('tok')).toEqual({ found: true, unsubscribed: false });
  });
  it('reports unsubscribed when the row has an opt-out timestamp', async () => {
    state.limit = [{ unsubscribedAt: new Date() }];
    expect(await getUnsubscribeStateByToken('tok')).toEqual({ found: true, unsubscribed: true });
  });
  it('treats an empty token as not found', async () => {
    expect(await getUnsubscribeStateByToken('')).toEqual({ found: false, unsubscribed: false });
  });
});
