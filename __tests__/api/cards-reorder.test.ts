import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { boardsFindFirst, cardsFindMany, updateSetSpy } = vi.hoisted(() => ({
  boardsFindFirst: vi.fn(),
  cardsFindMany: vi.fn(),
  updateSetSpy: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      boards: { findFirst: (...a: unknown[]) => boardsFindFirst(...a) },
      cards: { findMany: (...a: unknown[]) => cardsFindMany(...a) },
    },
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updateSetSpy(v);
        return { where: () => Promise.resolve() };
      },
    }),
  },
  boards: {},
  cards: {},
}));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));

import { auth } from '@/lib/auth';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';
import { PUT } from '@/app/api/boards/[boardId]/cards/order/route';
import { PUT as adminPUT } from '@/app/api/admin/boards/[id]/cards/order/route';
import { computeCardOrder } from '@/lib/card-order';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';
const params = Promise.resolve({ boardId: 'board-1' });

function makeReq(body: unknown) {
  return new Request('http://localhost/api/boards/board-1/cards/order', {
    method: 'PUT',
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { email: 'user@example.com', id: 'user-1' },
  } as never);
  boardsFindFirst.mockResolvedValue({ id: 'board-1', userId: 'user-1' });
  cardsFindMany.mockResolvedValue([
    { id: A, number: 1 },
    { id: B, number: 2 },
    { id: C, number: 3 },
  ]);
});

describe('computeCardOrder', () => {
  const current = [
    { id: A, number: 1 },
    { id: B, number: 2 },
    { id: C, number: 3 },
  ];

  it('numbers cards in the requested order', () => {
    expect(computeCardOrder(current, [C, A, B])).toEqual([
      { id: C, number: 1 },
      { id: A, number: 2 },
      { id: B, number: 3 },
    ]);
  });

  it('appends cards missing from the request, keeping their existing order', () => {
    expect(computeCardOrder(current, [C])).toEqual([
      { id: C, number: 1 },
      { id: A, number: 2 },
      { id: B, number: 3 },
    ]);
  });

  it('ignores unknown and duplicate ids', () => {
    expect(computeCardOrder(current, [B, 'not-on-board', B, A])).toEqual([
      { id: B, number: 1 },
      { id: A, number: 2 },
      { id: C, number: 3 },
    ]);
  });
});

describe('PUT /api/boards/[boardId]/cards/order', () => {
  it('persists the new order', async () => {
    const res = await PUT(makeReq({ cardIds: [C, A, B] }), { params });
    expect(res.status).toBe(200);
    expect(updateSetSpy).toHaveBeenCalledTimes(1);
    expect(updateSetSpy.mock.calls[0][0]).toHaveProperty('number');
    const body = await res.json();
    expect(body.cards).toEqual([
      { id: C, number: 1 },
      { id: A, number: 2 },
      { id: B, number: 3 },
    ]);
  });

  it('skips the write when the order is unchanged', async () => {
    const res = await PUT(makeReq({ cardIds: [A, B, C] }), { params });
    expect(res.status).toBe(200);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  it('returns 404 for a board the user does not own', async () => {
    boardsFindFirst.mockResolvedValue(undefined);
    const res = await PUT(makeReq({ cardIds: [C, A, B] }), { params });
    expect(res.status).toBe(404);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  it('returns 401 when signed out', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await PUT(makeReq({ cardIds: [C, A, B] }), { params });
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed body', async () => {
    const res = await PUT(makeReq({ cardIds: 'nope' }), { params });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/admin/boards/[id]/cards/order', () => {
  const adminParams = Promise.resolve({ id: 'board-1' });

  it("lets the admin reorder another user's board and invalidates the owner's preview", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' },
    } as never);
    boardsFindFirst.mockResolvedValue({ userId: 'owner-1' });
    const res = await adminPUT(makeReq({ cardIds: [C, A, B] }), { params: adminParams });
    expect(res.status).toBe(200);
    expect(updateSetSpy).toHaveBeenCalledTimes(1);
    expect(invalidateBoardPreview).toHaveBeenCalledWith('board-1', 'owner-1');
  });

  it('returns 404 to non-admins', async () => {
    const res = await adminPUT(makeReq({ cardIds: [C, A, B] }), { params: adminParams });
    expect(res.status).toBe(404);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });
});
