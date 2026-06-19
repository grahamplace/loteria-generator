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
vi.mock('@/lib/blob', () => ({
  uploadIllustration: vi.fn(),
  base64ToBuffer: vi.fn(),
  deleteCardImages: vi.fn(),
  uploadOriginalImage: vi.fn(),
  getContentTypeFromDataUrl: vi.fn(),
}));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));

import { auth } from '@/lib/auth';
import { PATCH } from '@/app/api/boards/[boardId]/cards/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const params = Promise.resolve({ boardId: 'board-1' });
const crop = { x: 5, y: 6, width: 7, height: 8 };

function makeReq(body: unknown) {
  return new Request('http://localhost/api/boards/board-1/cards', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  cardsFindFirst.mockResolvedValue({ id: 'c1', boardId: 'board-1', userId: 'admin-1' });
});

describe('PATCH /api/boards/[boardId]/cards cropData', () => {
  it('admin persists cropData', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    const res = await PATCH(
      makeReq({ cardId: '11111111-1111-1111-1111-111111111111', cropData: crop }),
      { params }
    );
    expect(res.status).toBe(200);
    const setArg = updateSetSpy.mock.calls.map((c) => c[0]).find((v) => 'cropData' in v);
    expect(setArg?.cropData).toEqual(crop);
  });

  it('non-admin: cropData is ignored', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { email: 'user@example.com', id: 'user-1' },
    } as never);
    cardsFindFirst.mockResolvedValue({ id: 'c1', boardId: 'board-1', userId: 'user-1' });
    const res = await PATCH(
      makeReq({ cardId: '11111111-1111-1111-1111-111111111111', cropData: crop }),
      { params }
    );
    expect(res.status).toBe(200);
    const setArg = updateSetSpy.mock.calls.map((c) => c[0]).find((v) => 'cropData' in v);
    expect(setArg).toBeUndefined();
  });
});
