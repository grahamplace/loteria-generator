import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { cardsFindFirst, updateSetSpy, invalidateMock } = vi.hoisted(() => ({
  cardsFindFirst: vi.fn(),
  updateSetSpy: vi.fn(),
  invalidateMock: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: { cards: { findFirst: (...a: unknown[]) => cardsFindFirst(...a) } },
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updateSetSpy(v);
        return { where: () => ({ returning: () => Promise.resolve([{ id: 'c1', ...v }]) }) };
      },
    }),
  },
  cards: {},
}));

vi.mock('@/lib/invalidate-board-preview', () => ({
  invalidateBoardPreview: (...a: unknown[]) => invalidateMock(...a),
}));

import { auth } from '@/lib/auth';
import { PUT } from '@/app/api/admin/cards/[cardId]/label/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const USER = { user: { email: 'someone@example.com', id: 'user-9' } };
const params = (cardId = 'c1') => Promise.resolve({ cardId });
const req = (body: unknown) =>
  new Request('http://localhost/api/admin/cards/c1/label', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  cardsFindFirst.mockResolvedValue({
    id: 'c1',
    boardId: 'board-1',
    userId: 'owner-1',
    label: 'El Gato',
  });
});

describe('PUT /api/admin/cards/[cardId]/label', () => {
  it('saves the trimmed label and invalidates the owner’s board preview', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    const res = await PUT(req({ label: '  La Gata  ' }), { params: params() });
    expect(res.status).toBe(200);
    const setArg = updateSetSpy.mock.calls.at(-1)![0];
    expect(setArg.label).toBe('La Gata');
    expect(setArg.updatedAt).toBeInstanceOf(Date);
    expect(invalidateMock).toHaveBeenCalledWith('board-1', 'owner-1');
    const json = await res.json();
    expect(json.card.label).toBe('La Gata');
  });

  it('skips the write when the label is unchanged', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    const res = await PUT(req({ label: 'El Gato ' }), { params: params() });
    expect(res.status).toBe(200);
    expect(updateSetSpy).not.toHaveBeenCalled();
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it('rejects non-admin with 404', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    const res = await PUT(req({ label: 'La Gata' }), { params: params() });
    expect(res.status).toBe(404);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing card', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    cardsFindFirst.mockResolvedValue(undefined);
    const res = await PUT(req({ label: 'La Gata' }), { params: params() });
    expect(res.status).toBe(404);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  it.each([[{ label: '   ' }], [{ label: 'x'.repeat(201) }], [{}]])(
    'rejects an invalid body %j with 400',
    async (body) => {
      vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
      const res = await PUT(req(body), { params: params() });
      expect(res.status).toBe(400);
      expect(updateSetSpy).not.toHaveBeenCalled();
    }
  );
});
