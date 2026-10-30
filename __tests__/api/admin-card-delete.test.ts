import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { cardsFindFirst, deleteMock, invalidateMock } = vi.hoisted(() => ({
  cardsFindFirst: vi.fn(),
  deleteMock: vi.fn(),
  invalidateMock: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: { query: { cards: { findFirst: (...a: unknown[]) => cardsFindFirst(...a) } } },
  cards: {},
}));

vi.mock('@/lib/boards/delete-card', () => ({
  deleteCardAndRenumber: (...a: unknown[]) => deleteMock(...a),
}));

vi.mock('@/lib/invalidate-board-preview', () => ({
  invalidateBoardPreview: (...a: unknown[]) => invalidateMock(...a),
}));

import { auth } from '@/lib/auth';
import { DELETE } from '@/app/api/admin/cards/[cardId]/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const USER = { user: { email: 'someone@example.com', id: 'user-9' } };
const params = (cardId = 'c1') => Promise.resolve({ cardId });
const req = () =>
  new Request('http://localhost/api/admin/cards/c1', {
    method: 'DELETE',
  }) as unknown as import('next/server').NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  cardsFindFirst.mockResolvedValue({
    id: 'c1',
    boardId: 'board-1',
    userId: 'owner-1',
    isDefault: false,
  });
});

describe('DELETE /api/admin/cards/[cardId]', () => {
  it("deletes another user's card as its owner and clears the preview", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    const res = await DELETE(req(), { params: params() });
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith('board-1', 'c1', 'owner-1', { isDefault: false });
    expect(invalidateMock).toHaveBeenCalledWith('board-1', 'owner-1');
  });

  it('keeps shared default-card images', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    cardsFindFirst.mockResolvedValue({
      id: 'c1',
      boardId: 'board-1',
      userId: 'owner-1',
      isDefault: true,
    });
    await DELETE(req(), { params: params() });
    expect(deleteMock).toHaveBeenCalledWith('board-1', 'c1', 'owner-1', { isDefault: true });
  });

  it('rejects non-admin with 404', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    const res = await DELETE(req(), { params: params() });
    expect(res.status).toBe(404);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing card', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    cardsFindFirst.mockResolvedValue(undefined);
    const res = await DELETE(req(), { params: params() });
    expect(res.status).toBe(404);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
