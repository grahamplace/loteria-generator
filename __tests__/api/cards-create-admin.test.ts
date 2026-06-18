import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { boardsFindFirst, cardsFindMany, insertValuesSpy, sendMock } = vi.hoisted(() => ({
  boardsFindFirst: vi.fn(),
  cardsFindMany: vi.fn(),
  insertValuesSpy: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      boards: { findFirst: (...a: unknown[]) => boardsFindFirst(...a) },
      cards: { findMany: (...a: unknown[]) => cardsFindMany(...a) },
    },
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        insertValuesSpy(v);
        return {
          returning: () => Promise.resolve([{ id: 'new-card', label: v.label, status: v.status }]),
        };
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
  },
  boards: {},
  cards: { number: 'cards.number', boardId: 'cards.boardId', id: 'cards.id' },
  IMAGE_GENERATION_LIMIT_FREE: 4,
  IMAGE_GENERATION_LIMIT_PAID: 100,
}));

vi.mock('@/lib/inngest/client', () => ({ inngest: { send: (...a: unknown[]) => sendMock(...a) } }));
vi.mock('@/lib/blob', () => ({
  uploadOriginalImage: vi.fn(async () => 'https://blob/original.png'),
  uploadIllustration: vi.fn(),
  deleteCardImages: vi.fn(),
  base64ToBuffer: vi.fn(() => Buffer.from('x')),
  getContentTypeFromDataUrl: vi.fn(() => 'image/png'),
}));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));
vi.mock('@/lib/posthog-server', () => ({ getPostHogClient: () => null }));

import { auth } from '@/lib/auth';
import { POST } from '@/app/api/boards/[boardId]/cards/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const USER = { user: { email: 'user@example.com', id: 'user-1' } };
const IMG = 'data:image/png;base64,AAAA';
const params = Promise.resolve({ boardId: 'board-1' });

function makeReq(body: unknown) {
  return new Request('http://localhost/api/boards/board-1/cards', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  cardsFindMany.mockResolvedValue([]);
  // Ensure the production inngest path is taken (not the E2E skip-AI shortcut)
  vi.stubEnv('NEXT_PUBLIC_SKIP_AI_PROCESSING', 'false');
});

describe('POST /api/boards/[boardId]/cards admin skipLabeling', () => {
  it('admin: stores filename label and sends event with skipLabeling true', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    boardsFindFirst.mockResolvedValue({
      id: 'board-1',
      userId: 'admin-1',
      isUnlocked: true,
      imageGenerationsUsed: 0,
    });

    const res = await POST(
      makeReq({ originalImageBase64: IMG, label: 'El Perro', skipLabeling: true }),
      { params }
    );
    expect(res.status).toBe(201);
    expect(insertValuesSpy.mock.calls[0][0]).toMatchObject({
      label: 'El Perro',
      status: 'processing',
    });
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      name: 'card/generate.requested',
      data: { skipLabeling: true, cardId: 'new-card', boardId: 'board-1' },
    });
  });

  it('non-admin: skipLabeling is ignored in the emitted event', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    boardsFindFirst.mockResolvedValue({
      id: 'board-1',
      userId: 'user-1',
      isUnlocked: false,
      imageGenerationsUsed: 0,
    });

    const res = await POST(
      makeReq({ originalImageBase64: IMG, label: 'El Perro', skipLabeling: true }),
      { params }
    );
    expect(res.status).toBe(201);
    expect(sendMock.mock.calls[0][0].data.skipLabeling).toBeFalsy();
  });

  it('admin bypasses the card limit', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    boardsFindFirst.mockResolvedValue({
      id: 'board-1',
      userId: 'admin-1',
      isUnlocked: true,
      imageGenerationsUsed: 0,
    });
    cardsFindMany.mockResolvedValue(new Array(60).fill({}));

    const res = await POST(makeReq({ originalImageBase64: IMG, label: 'X', skipLabeling: true }), {
      params,
    });
    expect(res.status).toBe(201);
  });

  it('non-admin still hits the card limit', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    boardsFindFirst.mockResolvedValue({
      id: 'board-1',
      userId: 'user-1',
      isUnlocked: false,
      imageGenerationsUsed: 0,
    });
    cardsFindMany.mockResolvedValue(new Array(4).fill({}));

    const res = await POST(makeReq({ originalImageBase64: IMG, label: 'X' }), { params });
    expect(res.status).toBe(403);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
