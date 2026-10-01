import { describe, it, expect, beforeEach, vi } from 'vitest';

const { captured, updateSetSpy, cardsFindFirst, chatCreate, imagesEdit } = vi.hoisted(() => ({
  captured: {} as { handler?: (arg: unknown) => Promise<unknown> },
  updateSetSpy: vi.fn(),
  cardsFindFirst: vi.fn(),
  chatCreate: vi.fn(),
  imagesEdit: vi.fn(),
}));

const { extractCrop } = vi.hoisted(() => ({ extractCrop: vi.fn(async (b: Buffer) => b) }));
vi.mock('@/lib/crop-region', () => ({ extractCrop }));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: (_config: unknown, handler: (arg: unknown) => Promise<unknown>) => {
      captured.handler = handler;
      return {};
    },
  },
}));

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: { completions: { create: chatCreate } },
    images: { edit: imagesEdit },
  })),
  toFile: vi.fn(async () => 'file'),
}));

vi.mock('@/db', () => ({
  db: {
    query: { cards: { findFirst: cardsFindFirst } },
    update: () => ({
      set: (v: unknown) => {
        updateSetSpy(v);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  },
  boards: { id: 'boards.id', imageGenerationsUsed: 'boards.imageGenerationsUsed' },
  cards: { id: 'cards.id', label: 'cards.label' },
}));

vi.mock('@/lib/blob', () => ({
  fetchBlob: vi.fn(async () => ({ buffer: Buffer.from('orig'), contentType: 'image/png' })),
  uploadIllustration: vi.fn(async () => 'https://blob/illustration.png'),
}));
vi.mock('@/lib/image-normalize', () => ({
  normalizeImageForOpenAI: vi.fn(async () => Buffer.from('normalized')),
}));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));
vi.mock('@/lib/ai-tracing', () => ({
  withAITrace: (_name: string, _meta: unknown, fn: () => unknown) => fn(),
}));

// Imports generate-card-artwork too; regenerate's createFunction runs last,
// so captured.handler is the regenerate handler.
import '@/lib/inngest/functions/regenerate-illustration';

const CARD = '00000000-0000-0000-0000-000000000001';
const BOARD = '00000000-0000-0000-0000-000000000002';
const CROP = { x: 1, y: 2, width: 3, height: 4 };

function makeStep() {
  return {
    run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
    realtime: { publish: vi.fn(async () => {}) },
  };
}

function persistCall() {
  return updateSetSpy.mock.calls
    .map((c) => c[0] as Record<string, unknown>)
    .find((v) => v.status === 'completed');
}

function runRegenerate() {
  return captured.handler!({
    event: {
      data: { cardId: CARD, boardId: BOARD, userId: 'u1', originalImageUrl: 'https://blob/o.png' },
    },
    step: makeStep(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  imagesEdit.mockResolvedValue({ data: [{ b64_json: Buffer.from('img').toString('base64') }] });
});

describe('regenerate-illustration', () => {
  it('crops the original before AI when the card has cropData', async () => {
    cardsFindFirst.mockResolvedValue({ cropData: CROP, preserveOriginal: true });
    await runRegenerate();
    expect(extractCrop).toHaveBeenCalledWith(expect.any(Buffer), CROP);
    expect(imagesEdit).toHaveBeenCalled();
  });

  it('does not crop when the card has no cropData', async () => {
    cardsFindFirst.mockResolvedValue({ cropData: null, preserveOriginal: false });
    await runRegenerate();
    expect(extractCrop).not.toHaveBeenCalled();
  });

  it('clears preserveOriginal so the proxies stop cropping the AI drawing', async () => {
    cardsFindFirst.mockResolvedValue({ cropData: CROP, preserveOriginal: true });
    await runRegenerate();
    const persisted = persistCall();
    expect(persisted!.illustrationUrl).toBe('https://blob/illustration.png');
    expect(persisted!.preserveOriginal).toBe(false);
    // Kept so "Use original photo" can restore the same crop later.
    expect(persisted).not.toHaveProperty('cropData');
  });
});
