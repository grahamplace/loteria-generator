import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { boardsFindMany, profileFindFirst, insertValuesSpy } = vi.hoisted(() => ({
  boardsFindMany: vi.fn(),
  profileFindFirst: vi.fn(),
  insertValuesSpy: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      boards: { findMany: (...a: unknown[]) => boardsFindMany(...a) },
      userProfiles: { findFirst: (...a: unknown[]) => profileFindFirst(...a) },
    },
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        insertValuesSpy(v);
        return { returning: () => Promise.resolve([{ id: 'new-board', ...v }]) };
      },
    }),
  },
  boards: {},
  userProfiles: {},
}));

import { auth } from '@/lib/auth';
import { POST } from '@/app/api/boards/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const USER = { user: { email: 'user@example.com', id: 'user-1' } };

function makeReq(body: unknown) {
  return new Request('http://localhost/api/boards', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  profileFindFirst.mockResolvedValue({ id: 'x' });
});

describe('POST /api/boards admin behavior', () => {
  it('admin bypasses the board limit and creates an unlocked board', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    boardsFindMany.mockResolvedValue([
      { isUnlocked: false },
      { isUnlocked: false },
      { isUnlocked: false },
    ]);

    const res = await POST(makeReq({ name: 'Admin Board' }));
    expect(res.status).toBe(201);
    expect(insertValuesSpy).toHaveBeenCalledOnce();
    expect(insertValuesSpy.mock.calls[0][0]).toMatchObject({
      name: 'Admin Board',
      isUnlocked: true,
    });
  });

  it('non-admin still hits the board limit', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    boardsFindMany.mockResolvedValue([{ isUnlocked: false }]);

    const res = await POST(makeReq({ name: 'Mine' }));
    expect(res.status).toBe(403);
    expect(insertValuesSpy).not.toHaveBeenCalled();
  });
});
