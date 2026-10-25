import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  adminSession: vi.fn(),
  find: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
  hardDelete: vi.fn(),
  deleteImages: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock('@/lib/admin', () => ({ getAdminSession: mocks.adminSession }));
vi.mock('@/lib/blob', () => ({ deleteBoardImages: mocks.deleteImages }));
vi.mock('@/db', () => ({
  boards: { id: 'id', userId: 'userId', deletedAt: 'deletedAt' },
  db: {
    query: { boards: { findFirst: mocks.find } },
    update: () => ({
      set: (values: unknown) => {
        mocks.set(values);
        return Object.assign(Promise.resolve(), {
          where: () => Object.assign(Promise.resolve(), { returning: mocks.returning }),
        });
      },
    }),
    delete: mocks.hardDelete,
  },
}));

import { DELETE } from '@/app/api/boards/[boardId]/route';
import { POST as restore } from '@/app/api/admin/boards/[id]/restore/route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: 'user-1', email: 'owner@example.com' } });
  mocks.adminSession.mockResolvedValue({ user: { id: 'admin' } });
  mocks.find.mockResolvedValue({ id: 'board-1', userId: 'user-1' });
  mocks.returning.mockResolvedValue([{ id: 'board-1' }]);
});

describe('deleting a board', () => {
  it('marks the board deleted and keeps its row, cards and images', async () => {
    const res = await DELETE(new Request('http://localhost') as never, {
      params: Promise.resolve({ boardId: 'board-1' }),
    });
    expect(res.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith({ deletedAt: expect.any(Date) });
    expect(mocks.hardDelete).not.toHaveBeenCalled();
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it('treats a board that is already deleted as missing', async () => {
    mocks.find.mockResolvedValue(undefined);
    const res = await DELETE(new Request('http://localhost') as never, {
      params: Promise.resolve({ boardId: 'board-1' }),
    });
    expect(res.status).toBe(404);
    expect(mocks.set).not.toHaveBeenCalled();
  });
});

describe('restoring a board', () => {
  it('clears the deleted mark for an admin', async () => {
    const res = await restore(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ id: 'board-1' }),
    });
    expect(res.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith({ deletedAt: null });
  });

  it('is hidden from non-admins', async () => {
    mocks.adminSession.mockResolvedValue(null);
    const res = await restore(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ id: 'board-1' }),
    });
    expect(res.status).toBe(404);
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
