import { describe, it, expect, vi } from 'vitest';

// Mock the DB so that importing signup-nudge.ts does not attempt to connect
vi.mock('@/db', () => ({ db: {}, user: {}, userProfiles: {} }));

import { getSignupNudgeWindow } from '@/lib/marketing/signup-nudge';

describe('getSignupNudgeWindow', () => {
  it('returns a [now-48h, now-24h) window', () => {
    const now = new Date('2026-06-22T12:00:00.000Z');
    const { gte, lt } = getSignupNudgeWindow(now);
    expect(gte.toISOString()).toBe('2026-06-20T12:00:00.000Z');
    expect(lt.toISOString()).toBe('2026-06-21T12:00:00.000Z');
  });
});
