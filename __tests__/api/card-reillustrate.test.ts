import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/db/schema';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findBoard: vi.fn(),
  write: vi.fn(),
  send: vi.fn(),
  isAdmin: vi.fn(),
  claim: true,
}));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/db', async () => ({
  ...(await import('@/db/schema')),
  db: {
    query: { cards: { findFirst: mocks.find }, boards: { findFirst: mocks.findBoard } },
    update: () => ({
      set: (patch: Partial<Card>) => {
        mocks.write(patch);
        const rows = mocks.claim ? [{ ...card, ...patch }] : [];
        return {
          where: () => Object.assign(Promise.resolve(rows), { returning: async () => rows }),
        };
      },
    }),
  },
}));
vi.mock('@/lib/inngest/client', () => ({ inngest: { send: mocks.send } }));
vi.mock('@/lib/admin', () => ({ isAdminEmail: mocks.isAdmin }));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));
import { auth } from '@/lib/auth';
import { POST } from '@/app/api/boards/[boardId]/cards/[cardId]/reillustrate/route';

const id = '00000000-0000-0000-0000-000000000001';
const boardId = '00000000-0000-0000-0000-000000000002';
const original = 'https://private.blob/original.png';
const crop = { x: 10, y: 20, width: 100, height: 150 };
let card: Card;
function request(notes: unknown) {
  return new Request('http://localhost/api/boards/board/cards/card/reillustrate', {
    method: 'POST',
    body: JSON.stringify({ notes }),
  }) as NextRequest;
}
async function run(notes: unknown) {
  return POST(request(notes), { params: Promise.resolve({ boardId, cardId: id }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claim = true;
  mocks.send.mockResolvedValue({ ids: ['event-1'] });
  mocks.isAdmin.mockReturnValue(false);
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: 'owner', email: 'owner@example.com' },
  } as never);
  card = {
    id,
    boardId,
    userId: 'owner',
    number: 2,
    label: 'La Abuela',
    riddle: 'Her saved verse',
    originalImageUrl: original,
    illustrationUrl: original,
    savedIllustrationUrl: null,
    preserveOriginal: true,
    cropData: crop,
    fromSheet: false,
    status: 'completed',
    errorMessage: null,
    errorDismissedAt: null,
    promptOverlay: null,
    isDefault: false,
    defaultCardId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mocks.find.mockImplementation(async () => card);
  mocks.findBoard.mockResolvedValue({
    id: boardId,
    userId: 'owner',
    isUnlocked: false,
    generationLimitOverride: null,
    imageGenerationsUsed: 0,
  });
});

describe('POST reillustrate', () => {
  it('401 without session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    expect((await run('x')).status).toBe(401);
  });
  it('404 when the card belongs to another user', async () => {
    mocks.find.mockResolvedValue(undefined);
    expect((await run('x')).status).toBe(404);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('404 when the board is not found', async () => {
    mocks.findBoard.mockResolvedValue(undefined);
    expect((await run('x')).status).toBe(404);
  });
  it('400 NO_PHOTO for a default card', async () => {
    card = { ...card, isDefault: true, originalImageUrl: null };
    const response = await run('x');
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('NO_PHOTO');
  });
  it('400 when notes exceed 500 chars', async () => {
    expect((await run('x'.repeat(501))).status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('409 BUSY when card status is processing', async () => {
    card.status = 'processing';
    const response = await run('x');
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('BUSY');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('403 GENERATION_LIMIT_REACHED when imageGenerationsUsed >= limit for non-admin', async () => {
    mocks.findBoard.mockResolvedValue({
      id: boardId,
      userId: 'owner',
      isUnlocked: false,
      generationLimitOverride: null,
      imageGenerationsUsed: 4,
    });
    const response = await run('x');
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('GENERATION_LIMIT_REACHED');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('admin bypasses the generation limit', async () => {
    mocks.isAdmin.mockReturnValue(true);
    mocks.findBoard.mockResolvedValue({
      id: boardId,
      userId: 'owner',
      isUnlocked: false,
      generationLimitOverride: null,
      imageGenerationsUsed: 4,
    });
    expect((await run('x')).status).toBe(200);
  });
  it('success stores trimmed notes, flips preserveOriginal false, sets processing', async () => {
    const response = await run('  Keep the glasses  ');
    expect(response.status).toBe(200);
    expect(mocks.write).toHaveBeenCalledWith(
      expect.objectContaining({
        promptOverlay: 'Keep the glasses',
        preserveOriginal: false,
        status: 'processing',
        errorMessage: null,
      })
    );
  });
  it('whitespace-only notes are stored as null', async () => {
    await run('   ');
    expect(mocks.write.mock.calls[0][0]).toHaveProperty('promptOverlay', null);
  });
  it('sends card/generate.requested with skipLabeling and skipSheetDetection', async () => {
    await run('x');
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'card/generate.requested',
        data: expect.objectContaining({
          cardId: id,
          boardId,
          userId: 'owner',
          originalImageUrl: original,
          skipLabeling: true,
          skipSheetDetection: true,
          cropData: crop,
          fromSheet: false,
        }),
      })
    );
  });
  it('409 CONFLICT when the claim is lost', async () => {
    mocks.claim = false;
    const response = await run('x');
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('CONFLICT');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('503 QUEUE_FAILED rolls back status, preserveOriginal and errorMessage', async () => {
    mocks.send.mockRejectedValue(new Error('Queue unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await run('keep me');
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('QUEUE_FAILED');
    const rollback = mocks.write.mock.calls[1][0];
    expect(rollback).toEqual(
      expect.objectContaining({ status: 'completed', preserveOriginal: true, errorMessage: null })
    );
    expect(rollback).not.toHaveProperty('promptOverlay');
    vi.mocked(console.error).mockRestore();
  });
});
