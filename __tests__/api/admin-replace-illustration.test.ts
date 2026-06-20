import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { cardsFindFirst, updateSetSpy, uploadIllustrationMock } = vi.hoisted(() => ({
  cardsFindFirst: vi.fn(),
  updateSetSpy: vi.fn(),
  uploadIllustrationMock: vi.fn(),
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
  uploadIllustration: (...a: unknown[]) => uploadIllustrationMock(...a),
  base64ToBuffer: (s: string) => Buffer.from(s.split(',')[1] ?? '', 'base64'),
}));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));

const sharpToBuffer = vi.fn().mockResolvedValue(Buffer.from('png-bytes'));
vi.mock('sharp', () => {
  const chain: Record<string, unknown> = {};
  chain.rotate = () => chain;
  chain.resize = () => chain;
  chain.png = () => chain;
  chain.toBuffer = () => sharpToBuffer();
  return { default: vi.fn(() => chain) };
});

import { auth } from '@/lib/auth';
import { PUT } from '@/app/api/admin/cards/[cardId]/illustration/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const USER = { user: { email: 'someone@example.com', id: 'user-9' } };
const DATA_URL = 'data:image/jpeg;base64,' + Buffer.from('jpegdata').toString('base64');
const params = (cardId = 'c1') => Promise.resolve({ cardId });

function makeReq(body: unknown) {
  return new Request('http://localhost/api/admin/cards/c1/illustration', {
    method: 'PUT',
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  uploadIllustrationMock.mockResolvedValue('https://blob/illustration.png');
  cardsFindFirst.mockResolvedValue({
    id: 'c1',
    boardId: 'board-1',
    userId: 'owner-1',
    isDefault: false,
    preserveOriginal: true,
    cropData: { x: 1, y: 2, width: 3, height: 4 },
  });
});

describe('PUT /api/admin/cards/[cardId]/illustration', () => {
  it('admin replace: completed, flags cleared, owner id used for blob path', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    const res = await PUT(makeReq({ illustrationBase64: DATA_URL }), { params: params() });
    expect(res.status).toBe(200);
    const setArg = updateSetSpy.mock.calls.at(-1)![0];
    expect(setArg.status).toBe('completed');
    expect(setArg.illustrationUrl).toBe('https://blob/illustration.png');
    expect(setArg.preserveOriginal).toBe(false);
    expect(setArg.cropData).toBeNull();
    expect(setArg.errorMessage).toBeNull();
    expect(uploadIllustrationMock).toHaveBeenCalledWith(
      'owner-1',
      'board-1',
      'c1',
      expect.any(Buffer)
    );
  });

  it('normalizes the uploaded image through sharp', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    await PUT(makeReq({ illustrationBase64: DATA_URL }), { params: params() });
    expect(sharpToBuffer).toHaveBeenCalled();
  });

  it('rejects non-admin with 404', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    const res = await PUT(makeReq({ illustrationBase64: DATA_URL }), { params: params() });
    expect(res.status).toBe(404);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  it('rejects default cards with 400', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    cardsFindFirst.mockResolvedValue({
      id: 'c1',
      boardId: 'board-1',
      userId: 'owner-1',
      isDefault: true,
    });
    const res = await PUT(makeReq({ illustrationBase64: DATA_URL }), { params: params() });
    expect(res.status).toBe(400);
    expect(updateSetSpy).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing card', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    cardsFindFirst.mockResolvedValue(undefined);
    const res = await PUT(makeReq({ illustrationBase64: DATA_URL }), { params: params() });
    expect(res.status).toBe(404);
  });

  it('rejects a malformed (non data URL) payload with 400', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    const res = await PUT(makeReq({ illustrationBase64: 'not-a-data-url' }), { params: params() });
    expect(res.status).toBe(400);
    expect(updateSetSpy).not.toHaveBeenCalled();
    expect(uploadIllustrationMock).not.toHaveBeenCalled();
  });

  it('returns 400 (not 500) when the image cannot be decoded', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    sharpToBuffer.mockRejectedValueOnce(
      new Error('Input buffer contains unsupported image format')
    );
    const res = await PUT(makeReq({ illustrationBase64: DATA_URL }), { params: params() });
    expect(res.status).toBe(400);
    expect(updateSetSpy).not.toHaveBeenCalled();
    expect(uploadIllustrationMock).not.toHaveBeenCalled();
  });
});
