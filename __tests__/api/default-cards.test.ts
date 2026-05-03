import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const queryFindFirst = vi.fn();
const queryFindMany = vi.fn();
const insertReturning = vi.fn();

vi.mock('@/db', () => ({
  db: {
    query: {
      boards: { findFirst: (...a: unknown[]) => queryFindFirst(...a) },
      cards: { findMany: (...a: unknown[]) => queryFindMany(...a) },
    },
    insert: () => ({
      values: () => ({ returning: () => insertReturning() }),
    }),
  },
  boards: {},
  cards: {},
  IMAGE_GENERATION_LIMIT_FREE: 4,
  IMAGE_GENERATION_LIMIT_PAID: 100,
}));

vi.mock('@/lib/invalidate-board-preview', () => ({
  invalidateBoardPreview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/posthog-server', () => ({
  getPostHogClient: () => ({ capture: vi.fn(), shutdown: vi.fn().mockResolvedValue(undefined) }),
}));

import { auth } from '@/lib/auth';
import { POST } from '@/app/api/boards/[boardId]/cards/defaults/route';

const params = Promise.resolve({ boardId: 'board-1' });
const userSession = { user: { id: 'user-1' } };

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/boards/board-1/cards/defaults', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (auth.api.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(userSession);
});

describe('POST /api/boards/[boardId]/cards/defaults', () => {
  it('returns 401 when unauthenticated', async () => {
    (auth.api.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa'] }) as never, { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when board not found / not owned', async () => {
    queryFindFirst.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa'] }) as never, { params });
    expect(res.status).toBe(404);
  });

  it('returns 400 DUPLICATE_IDS when the request has duplicate ids', async () => {
    queryFindFirst.mockResolvedValue({
      id: 'board-1',
      userId: 'user-1',
      isUnlocked: false,
      imageGenerationsUsed: 0,
    });
    queryFindMany.mockResolvedValue([]);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa', 'la-rosa'] }) as never, {
      params,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('DUPLICATE_IDS');
  });

  it('returns 400 INVALID_DEFAULT_ID when an id is unknown', async () => {
    queryFindFirst.mockResolvedValue({
      id: 'board-1',
      userId: 'user-1',
      isUnlocked: false,
      imageGenerationsUsed: 0,
    });
    queryFindMany.mockResolvedValue([]);
    const res = await POST(makeRequest({ defaultCardIds: ['not-a-real-id'] }) as never, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_DEFAULT_ID');
  });

  it('returns 409 ALREADY_ADDED when classic already on board', async () => {
    queryFindFirst.mockResolvedValue({
      id: 'board-1',
      userId: 'user-1',
      isUnlocked: false,
      imageGenerationsUsed: 0,
    });
    queryFindMany.mockResolvedValue([{ defaultCardId: 'la-rosa', number: 1 }]);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa'] }) as never, { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('ALREADY_ADDED');
  });

  it('returns 403 CARD_LIMIT_REACHED on free tier when over the cap', async () => {
    queryFindFirst.mockResolvedValue({
      id: 'board-1',
      userId: 'user-1',
      isUnlocked: false,
      imageGenerationsUsed: 0,
    });
    queryFindMany.mockResolvedValue([
      { defaultCardId: null, number: 1 },
      { defaultCardId: null, number: 2 },
      { defaultCardId: null, number: 3 },
      { defaultCardId: null, number: 4 },
    ]);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa'] }) as never, { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('CARD_LIMIT_REACHED');
  });

  it('inserts and returns rows on success', async () => {
    queryFindFirst.mockResolvedValue({
      id: 'board-1',
      userId: 'user-1',
      isUnlocked: false,
      imageGenerationsUsed: 0,
    });
    queryFindMany.mockResolvedValue([]);
    insertReturning.mockResolvedValue([
      {
        id: 'card-1',
        boardId: 'board-1',
        userId: 'user-1',
        number: 1,
        label: 'La Rosa',
        illustrationUrl: '/default-cards/la-rosa.webp',
        isDefault: true,
        defaultCardId: 'la-rosa',
        status: 'completed',
      },
    ]);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa'] }) as never, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].defaultCardId).toBe('la-rosa');
  });
});
