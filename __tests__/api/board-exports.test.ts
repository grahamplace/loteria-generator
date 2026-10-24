import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { boardsFindFirst, insertValuesSpy } = vi.hoisted(() => ({
  boardsFindFirst: vi.fn(),
  insertValuesSpy: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: { boards: { findFirst: (...a: unknown[]) => boardsFindFirst(...a) } },
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        insertValuesSpy(v);
        return Promise.resolve();
      },
    }),
  },
  boards: {},
  boardExports: {},
}));

import { auth } from '@/lib/auth';
import { POST } from '@/app/api/boards/[boardId]/exports/route';

const OWNER = { user: { email: 'owner@example.com', id: 'user-1' } };
const STRANGER = { user: { email: 'someone@example.com', id: 'user-9' } };
const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const params = () => Promise.resolve({ boardId: 'board-1' });
const req = (body: unknown = { boardCount: 10, cardCount: 54 }) =>
  new Request('http://localhost/api/boards/board-1/exports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.getSession).mockResolvedValue(OWNER as never);
  boardsFindFirst.mockResolvedValue({ id: 'board-1', userId: 'user-1', isUnlocked: true });
});

describe('POST /api/boards/[boardId]/exports', () => {
  it("records the owner's export as a customer export", async () => {
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(201);
    expect(insertValuesSpy).toHaveBeenCalledWith({
      boardId: 'board-1',
      userId: 'user-1',
      source: 'user',
      boardCount: 10,
      cardCount: 54,
      wasUnlocked: true,
    });
  });

  it("records the admin exporting someone's board as an admin export, owned by the board owner", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(201);
    expect(insertValuesSpy.mock.calls[0][0]).toMatchObject({ userId: 'user-1', source: 'admin' });
  });

  it("404s on another user's board", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(STRANGER as never);
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(404);
    expect(insertValuesSpy).not.toHaveBeenCalled();
  });

  it('401s when signed out', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(401);
  });

  it('rejects invalid counts', async () => {
    const res = await POST(req({ boardCount: -1 }), { params: params() });
    expect(res.status).toBe(400);
  });
});
