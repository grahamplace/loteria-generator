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
import { POST } from '@/app/api/admin/cards/[cardId]/use-original/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const USER = { user: { email: 'someone@example.com', id: 'user-9' } };
const CROP = { x: 1, y: 2, width: 3, height: 4 };
const params = (cardId = 'c1') => Promise.resolve({ cardId });
const req = () =>
  new Request('http://localhost/api/admin/cards/c1/use-original', {
    method: 'POST',
  }) as unknown as import('next/server').NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  cardsFindFirst.mockResolvedValue({
    id: 'c1',
    boardId: 'board-1',
    userId: 'owner-1',
    isDefault: false,
    originalImageUrl: 'https://blob/original.jpg',
    illustrationUrl: 'https://blob/illustration.png',
    preserveOriginal: false,
    cropData: CROP,
  });
});

describe('POST /api/admin/cards/[cardId]/use-original', () => {
  it('points the illustration at the original photo and keeps the crop', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(200);
    const setArg = updateSetSpy.mock.calls.at(-1)![0];
    expect(setArg.illustrationUrl).toBe('https://blob/original.jpg');
    expect(setArg.preserveOriginal).toBe(true);
    expect(setArg.status).toBe('completed');
    expect(setArg.errorMessage).toBeNull();
    // The crop is in original-photo coordinates, so it stays valid as a serve-time crop.
    expect(setArg).not.toHaveProperty('cropData');
    expect(invalidateMock).toHaveBeenCalledWith('board-1', 'owner-1');
  });

  it('rejects non-admin with 404', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(404);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing card', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    cardsFindFirst.mockResolvedValue(undefined);
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(404);
  });

  it('rejects default cards with 400', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    cardsFindFirst.mockResolvedValue({ id: 'c1', isDefault: true, originalImageUrl: 'x' });
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(400);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  it('rejects cards without an original photo with 400', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    cardsFindFirst.mockResolvedValue({ id: 'c1', isDefault: false, originalImageUrl: null });
    const res = await POST(req(), { params: params() });
    expect(res.status).toBe(400);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });
});
