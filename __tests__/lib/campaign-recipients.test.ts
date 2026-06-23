// __tests__/lib/campaign-recipients.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Terminal operation for the select chain is `.where()`
const state = { where: [] as unknown[] };

vi.mock('@/db', () => {
  const chain: Record<string, unknown> = {};
  const ret = () => chain;
  for (const m of ['select', 'from', 'leftJoin']) {
    chain[m] = vi.fn(ret);
  }
  chain.where = vi.fn(async () => state.where);
  return { db: chain, user: {}, userProfiles: {} };
});

// drizzle-orm operators are no-ops in tests
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  inArray: vi.fn(),
}));

import { db } from '@/db';
import { getCampaignRecipients, type CampaignRecipient } from '@/lib/marketing/campaign-recipients';

const dbChain = db as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  state.where = [];
  vi.clearAllMocks();
});

describe('getCampaignRecipients', () => {
  it('returns [] immediately and never calls db.select when userIds is empty', async () => {
    const result = await getCampaignRecipients([]);
    expect(result).toEqual([]);
    expect(dbChain.select).not.toHaveBeenCalled();
  });

  it('returns the rows resolved by the db mock for a non-empty userIds list', async () => {
    const fakeRows: CampaignRecipient[] = [
      { id: 'u1', email: 'alice@example.com', name: 'Alice', locale: 'en' },
      { id: 'u2', email: 'bob@example.com', name: 'Bob', locale: null },
    ];
    state.where = fakeRows;

    const result = await getCampaignRecipients(['u1', 'u2']);
    expect(result).toEqual(fakeRows);
    expect(dbChain.select).toHaveBeenCalledOnce();
  });
});
