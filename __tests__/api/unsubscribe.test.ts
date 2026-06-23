// __tests__/api/unsubscribe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/email/unsubscribe', () => ({
  unsubscribeByToken: vi.fn(),
}));

import { unsubscribeByToken } from '@/lib/email/unsubscribe';
import { POST } from '@/app/api/unsubscribe/route';
import { NextRequest } from 'next/server';

function req(token?: string) {
  const url = token
    ? `http://localhost/api/unsubscribe?token=${token}`
    : 'http://localhost/api/unsubscribe';
  return new NextRequest(url, { method: 'POST' });
}

describe('POST /api/unsubscribe', () => {
  beforeEach(() => vi.mocked(unsubscribeByToken).mockReset());

  it('unsubscribes a valid token and reports success', async () => {
    vi.mocked(unsubscribeByToken).mockResolvedValue({ ok: true, userId: 'u1' });
    const res = await POST(req('tok123'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ unsubscribed: true });
    expect(unsubscribeByToken).toHaveBeenCalledWith('tok123');
  });

  it('returns 200 with unsubscribed:false for an unknown token', async () => {
    vi.mocked(unsubscribeByToken).mockResolvedValue({ ok: false });
    const res = await POST(req('nope'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ unsubscribed: false });
  });

  it('handles a missing token without throwing', async () => {
    vi.mocked(unsubscribeByToken).mockResolvedValue({ ok: false });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(unsubscribeByToken).toHaveBeenCalledWith('');
  });
});
