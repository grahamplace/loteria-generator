// __tests__/api/redeem.test.ts
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/redeem/route';
import {
  SIGNUP_NUDGE_EXPIRY_DAYS,
  REENGAGEMENT_EXPIRY_DAYS,
  NO_BOARD_EXPIRY_DAYS,
} from '@/lib/constants';

function get(url: string) {
  return GET(new NextRequest(new Request(url)));
}

describe('GET /redeem', () => {
  it('redirects to the board when boardId is supplied', async () => {
    const res = await get('https://example.com/redeem?code=LOTERIA-ABC123&boardId=board_1');
    expect(res.headers.get('location')).toBe('https://example.com/boards/board_1');
  });

  it('redirects to /start when no boardId is supplied', async () => {
    // The no-board campaign mails users with zero boards. /dashboard would strand
    // them on the empty state holding a code they cannot spend; /start creates the
    // board and drops them into it.
    const res = await get('https://example.com/redeem?code=LOTERIA-ABC123');
    expect(res.headers.get('location')).toBe('https://example.com/start');
  });

  it('stores the promo code in an httpOnly cookie', async () => {
    const res = await get('https://example.com/redeem?code=LOTERIA-ABC123');
    const cookie = res.cookies.get('loteria_promo');
    expect(cookie?.value).toBe('LOTERIA-ABC123');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
    expect(cookie?.path).toBe('/');
  });

  it('keeps the cookie alive at least as long as the longest campaign code', async () => {
    const res = await get('https://example.com/redeem?code=LOTERIA-ABC123');
    const longestDays = Math.max(
      SIGNUP_NUDGE_EXPIRY_DAYS,
      REENGAGEMENT_EXPIRY_DAYS,
      NO_BOARD_EXPIRY_DAYS
    );
    expect(res.cookies.get('loteria_promo')?.maxAge).toBe(longestDays * 24 * 60 * 60);
  });

  it('still redirects when the code is missing, without setting a cookie', async () => {
    const res = await get('https://example.com/redeem');
    expect(res.headers.get('location')).toBe('https://example.com/start');
    expect(res.cookies.get('loteria_promo')).toBeUndefined();
  });
});
