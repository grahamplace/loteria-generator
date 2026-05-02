import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/db', () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { POST } from '@/app/api/account/locale/route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/account/locale', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/account/locale', () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'user-123' },
    } as any);
    vi.mocked(db.update).mockClear();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await POST(makeReq({ locale: 'es-MX' }));
    expect(res.status).toBe(401);
  });

  it('rejects invalid locale with 400', async () => {
    const res = await POST(makeReq({ locale: 'fr' }));
    expect(res.status).toBe(400);
  });

  it('rejects bare es locale with 400', async () => {
    const res = await POST(makeReq({ locale: 'es' }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed body with 400', async () => {
    const res = await POST(makeReq({ wrong: 'shape' }));
    expect(res.status).toBe(400);
  });

  it('updates user_profiles.locale and returns 204 on success (locale=es-MX)', async () => {
    const res = await POST(makeReq({ locale: 'es-MX' }));
    expect(res.status).toBe(204);
    expect(db.update).toHaveBeenCalled();
  });

  it('accepts locale=en and returns 204', async () => {
    const res = await POST(makeReq({ locale: 'en' }));
    expect(res.status).toBe(204);
  });
});
