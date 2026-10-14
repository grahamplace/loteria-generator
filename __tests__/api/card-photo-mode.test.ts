import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/db/schema';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  write: vi.fn(),
  send: vi.fn(),
  stored: vi.fn(),
  claim: true,
}));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/db', async () => ({
  ...(await import('@/db/schema')),
  db: {
    query: { cards: { findFirst: mocks.find } },
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
vi.mock('@/lib/blob', () => ({ findCardIllustration: mocks.stored }));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));
import { auth } from '@/lib/auth';
import { POST } from '@/app/api/boards/[boardId]/cards/[cardId]/photo-mode/route';
import { POST as useOriginal } from '@/app/api/admin/cards/[cardId]/use-original/route';

const id = '00000000-0000-0000-0000-000000000001';
const boardId = '00000000-0000-0000-0000-000000000002';
const original = 'https://private.blob/original.png';
const illustration = 'https://private.blob/illustration.png';
let card: Card;
const crop = { x: 10, y: 20, width: 100, height: 150 };
function request(photoMode: unknown) {
  return new Request('http://localhost/api/boards/board/cards/card/photo-mode', {
    method: 'POST',
    body: JSON.stringify({ photoMode }),
  }) as NextRequest;
}
async function change(photoMode: unknown) {
  return POST(request(photoMode), { params: Promise.resolve({ boardId, cardId: id }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claim = true;
  mocks.send.mockResolvedValue({ ids: ['event-1'] });
  mocks.stored.mockResolvedValue(null);
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
    status: 'completed',
    errorMessage: null,
    promptOverlay: null,
    isDefault: false,
    defaultCardId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mocks.find.mockImplementation(async () => card);
});

describe('card photo mode', () => {
  it('queues the first illustration with the existing crop and no label generation', async () => {
    const response = await change('illustrated');
    expect(response.status).toBe(200);
    expect((await response.json()).card).toMatchObject({
      status: 'processing',
      preserveOriginal: false,
      label: 'La Abuela',
      riddle: 'Her saved verse',
      cropData: crop,
    });
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
          cropData: crop,
        }),
      })
    );
    expect(mocks.write.mock.calls[0][0]).not.toHaveProperty('label');
  });
  it('keeps and restores the most recent illustration over repeated mode changes', async () => {
    card.preserveOriginal = false;
    card.illustrationUrl = illustration;
    card.savedIllustrationUrl = 'https://private.blob/old-illustration.png';
    for (const mode of ['original', 'illustrated', 'original', 'illustrated']) {
      const response = await change(mode);
      expect(response.status).toBe(200);
      card = (await response.json()).card;
      expect(card.illustrationUrl).toBe(mode === 'original' ? original : illustration);
      expect(card.savedIllustrationUrl).toBe(illustration);
      expect(card.cropData).toEqual(crop);
      expect(card.status).toBe('completed');
    }
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.stored).not.toHaveBeenCalled();
  });
  it('recovers an illustration generated before the separate saved URL existed', async () => {
    mocks.stored.mockResolvedValue(illustration);
    const response = await change('illustrated');
    expect(mocks.stored).toHaveBeenCalledWith('owner', boardId, id);
    expect((await response.json()).card).toMatchObject({
      illustrationUrl: illustration,
      savedIllustrationUrl: illustration,
      status: 'completed',
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each(['pending', 'processing'] as const)(
    'does not enqueue another job while %s',
    async (status) => {
      card.status = status;
      expect((await change('illustrated')).status).toBe(409);
      expect((await change('original')).status).toBe(409);
      expect(mocks.write).not.toHaveBeenCalled();
      expect(mocks.send).not.toHaveBeenCalled();
    }
  );
  it('rejects a concurrent transition that lost the database claim', async () => {
    mocks.claim = false;
    expect((await change('illustrated')).status).toBe(409);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('restores the previous face after a queue failure so it can be retried', async () => {
    mocks.send.mockRejectedValue(new Error('Queue unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await change('illustrated')).status).toBe(503);
    expect(mocks.write.mock.calls.at(-1)?.[0]).toMatchObject({
      preserveOriginal: true,
      illustrationUrl: original,
      status: 'completed',
    });
    vi.mocked(console.error).mockRestore();
  });
  it('lets failed generation recover to its original photo or retry illustration', async () => {
    card.status = 'error';
    card.preserveOriginal = false;
    card.illustrationUrl = null;
    expect((await change('original')).status).toBe(200);
    expect(mocks.write.mock.calls.at(-1)?.[0]).toMatchObject({
      preserveOriginal: true,
      status: 'completed',
      errorMessage: null,
    });
    expect((await change('illustrated')).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledOnce();
  });
  it('also preserves the illustration when an admin selects the original', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'admin', email: 'graham@stonecutterlabs.com' },
    } as never);
    card.preserveOriginal = false;
    card.illustrationUrl = illustration;
    const response = await useOriginal(request('original'), {
      params: Promise.resolve({ cardId: id }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).card.savedIllustrationUrl).toBe(illustration);
  });
  it('rejects classic cards and cards without an uploaded photo', async () => {
    card.isDefault = true;
    expect((await change('illustrated')).status).toBe(400);
    card.isDefault = false;
    card.originalImageUrl = null;
    expect((await change('original')).status).toBe(400);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated, missing/unowned cards, and invalid modes', async () => {
    expect((await change('other')).status).toBe(400);
    mocks.find.mockResolvedValue(undefined);
    expect((await change('original')).status).toBe(404);
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    expect((await change('illustrated')).status).toBe(401);
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
