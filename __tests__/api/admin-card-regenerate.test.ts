import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { cardsFindFirst, boardsFindFirst, updateSetSpy, send } = vi.hoisted(() => ({
  cardsFindFirst: vi.fn(),
  boardsFindFirst: vi.fn(),
  updateSetSpy: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      cards: { findFirst: (...a: unknown[]) => cardsFindFirst(...a) },
      boards: { findFirst: (...a: unknown[]) => boardsFindFirst(...a) },
    },
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updateSetSpy(v);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  },
  cards: {},
  boards: {},
}));
vi.mock('@/lib/inngest/client', () => ({ inngest: { send } }));

import { auth } from '@/lib/auth';
import { POST } from '@/app/api/admin/cards/[cardId]/regenerate/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const params = () => Promise.resolve({ cardId: 'c1' });
const req = (body: unknown) =>
  new Request('http://localhost/api/admin/cards/c1/regenerate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
  cardsFindFirst.mockResolvedValue({
    id: 'c1',
    boardId: 'b1',
    userId: 'u1',
    originalImageUrl: 'https://blob/o.png',
  });
  boardsFindFirst.mockResolvedValue({ id: 'b1' });
});

describe('POST /api/admin/cards/[cardId]/regenerate image category', () => {
  it('saves a chosen category', async () => {
    const res = await POST(req({ promptOverlay: '', imageCategory: 'scene' }), {
      params: params(),
    });
    expect(res.status).toBe(200);
    expect(updateSetSpy.mock.calls[0][0].imageCategory).toBe('scene');
    expect(send).toHaveBeenCalled();
  });

  it('clears the category on auto so the job classifies again', async () => {
    await POST(req({ imageCategory: 'auto' }), { params: params() });
    expect(updateSetSpy.mock.calls[0][0]).toHaveProperty('imageCategory', null);
  });

  it('leaves the stored category alone when none or an unknown one is sent', async () => {
    await POST(req({ promptOverlay: 'x' }), { params: params() });
    await POST(req({ imageCategory: 'landscape' }), { params: params() });
    for (const [set] of updateSetSpy.mock.calls) expect(set).not.toHaveProperty('imageCategory');
  });
});
