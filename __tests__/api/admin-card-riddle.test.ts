import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { cardsFindFirst, updateSetSpy } = vi.hoisted(() => ({
  cardsFindFirst: vi.fn(),
  updateSetSpy: vi.fn(),
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

import { auth } from '@/lib/auth';
import { PUT } from '@/app/api/admin/cards/[cardId]/riddle/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const USER = { user: { email: 'someone@example.com', id: 'user-9' } };
const params = (cardId = 'c1') => Promise.resolve({ cardId });
const req = (body: unknown) =>
  new Request('http://localhost/api/admin/cards/c1/riddle', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
  cardsFindFirst.mockResolvedValue({ id: 'c1', boardId: 'board-1', riddle: 'Old riddle' });
});

describe('PUT /api/admin/cards/[cardId]/riddle', () => {
  it('saves the trimmed riddle', async () => {
    const res = await PUT(req({ riddle: '  Purrs on the porch  ' }), { params: params() });
    expect(res.status).toBe(200);
    const setArg = updateSetSpy.mock.calls.at(-1)![0];
    expect(setArg.riddle).toBe('Purrs on the porch');
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });

  it('clears the riddle when given only whitespace', async () => {
    const res = await PUT(req({ riddle: '   ' }), { params: params() });
    expect(res.status).toBe(200);
    expect(updateSetSpy.mock.calls.at(-1)![0].riddle).toBeNull();
  });

  it('skips the write when the riddle is unchanged', async () => {
    const res = await PUT(req({ riddle: 'Old riddle' }), { params: params() });
    expect(res.status).toBe(200);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  it('rejects a riddle over 500 characters', async () => {
    const res = await PUT(req({ riddle: 'x'.repeat(501) }), { params: params() });
    expect(res.status).toBe(400);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  it('404s for a missing card', async () => {
    cardsFindFirst.mockResolvedValue(undefined);
    const res = await PUT(req({ riddle: 'Hi' }), { params: params('nope') });
    expect(res.status).toBe(404);
  });

  it('404s for non-admins', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    const res = await PUT(req({ riddle: 'Hi' }), { params: params() });
    expect(res.status).toBe(404);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });
});
