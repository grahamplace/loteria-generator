import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
  convertForOpenAIVision: vi.fn(async () => Buffer.from('vision-jpeg')),
}));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));
vi.mock('@/lib/ai-tracing', () => ({
  withAITrace: (_name: string, _meta: unknown, fn: () => unknown) => fn(),
}));

import '@/lib/inngest/functions/generate-card-artwork';
import { fetchBlob } from '@/lib/blob';

const CARD = '00000000-0000-0000-0000-000000000001';
const BOARD = '00000000-0000-0000-0000-000000000002';

function makeStep() {
  const runNames: string[] = [];
  return {
    runNames,
    step: {
      run: vi.fn(async (name: string, fn: () => unknown) => {
        runNames.push(name);
        return fn();
      }),
      realtime: { publish: vi.fn(async () => {}) },
    },
  };
}

function persistCall() {
  return updateSetSpy.mock.calls
    .map((c) => c[0] as Record<string, unknown>)
    .find((v) => v.status === 'completed');
}

beforeEach(() => {
  vi.clearAllMocks();
  imagesEdit.mockResolvedValue({ data: [{ b64_json: Buffer.from('img').toString('base64') }] });
});

describe('generate-card-artwork skipLabeling', () => {
  it('skips the AI label step and preserves the existing label when skipLabeling is true', async () => {
    cardsFindFirst.mockResolvedValue({ label: 'El Sol' });
    const { runNames, step } = makeStep();

    await captured.handler!({
      event: {
        data: {
          cardId: CARD,
          boardId: BOARD,
          userId: 'u1',
          originalImageUrl: 'https://blob/o.png',
          skipLabeling: true,
        },
      },
      step,
    });

    expect(runNames).not.toContain('generate-label');
    expect(chatCreate).not.toHaveBeenCalled();
    const persisted = persistCall();
    expect(persisted).toBeDefined();
    expect(persisted).not.toHaveProperty('label');
    expect(persisted!.illustrationUrl).toBe('https://blob/illustration.png');
  });

  it('runs AI labeling and persists the AI label when skipLabeling is falsy', async () => {
    chatCreate.mockResolvedValue({ choices: [{ message: { content: '{"label":"La Luna"}' } }] });
    const { runNames, step } = makeStep();

    await captured.handler!({
      event: {
        data: {
          cardId: CARD,
          boardId: BOARD,
          userId: 'u1',
          originalImageUrl: 'https://blob/o.png',
        },
      },
      step,
    });

    expect(runNames).toContain('generate-label');
    expect(chatCreate).toHaveBeenCalledOnce();
    const persisted = persistCall();
    expect(persisted!.label).toBe('La Luna');
  });
});

describe('generate-card-artwork skipIllustration', () => {
  it('preserves the original image as the card face and skips AI illustration + counter', async () => {
    chatCreate.mockResolvedValue({ choices: [{ message: { content: '{"label":"La Luna"}' } }] });
    const { runNames, step } = makeStep();

    await captured.handler!({
      event: {
        data: {
          cardId: CARD,
          boardId: BOARD,
          userId: 'u1',
          originalImageUrl: 'https://blob/o.png',
          skipIllustration: true,
        },
      },
      step,
    });

    expect(imagesEdit).not.toHaveBeenCalled();
    expect(runNames).not.toContain('generate-and-upload-illustration');
    const persisted = persistCall();
    expect(persisted!.illustrationUrl).toBe('https://blob/o.png');
    const touchedCounter = updateSetSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .some((v) => 'imageGenerationsUsed' in v);
    expect(touchedCounter).toBe(false);
  });
});

describe('generate-card-artwork cropData (AI branch)', () => {
  it('crops the source before AI when cropData is present', async () => {
    chatCreate.mockResolvedValue({ choices: [{ message: { content: '{"label":"La Luna"}' } }] });
    const { step } = makeStep();
    await captured.handler!({
      event: {
        data: {
          cardId: CARD,
          boardId: BOARD,
          userId: 'u1',
          originalImageUrl: 'https://blob/o.png',
          cropData: { x: 1, y: 2, width: 3, height: 4 },
        },
      },
      step,
    });
    expect(extractCrop).toHaveBeenCalled();
    expect(imagesEdit).toHaveBeenCalled();
  });

  it('does not crop when cropData is absent', async () => {
    chatCreate.mockResolvedValue({ choices: [{ message: { content: '{"label":"La Luna"}' } }] });
    const { step } = makeStep();
    await captured.handler!({
      event: {
        data: {
          cardId: CARD,
          boardId: BOARD,
          userId: 'u1',
          originalImageUrl: 'https://blob/o.png',
        },
      },
      step,
    });
    expect(extractCrop).not.toHaveBeenCalled();
  });
});

describe('generate-card-artwork label validation', () => {
  const event = {
    data: { cardId: CARD, boardId: BOARD, userId: 'u1', originalImageUrl: 'https://blob/o.png' },
  };
  const reply = (content: string | null, finish_reason = 'stop') => ({
    choices: [{ message: { content }, finish_reason }],
  });

  it('requests JSON-schema structured output', async () => {
    chatCreate.mockResolvedValue(reply('{"label":"La Luna"}'));
    const { step } = makeStep();
    await captured.handler!({ event, step });
    const body = chatCreate.mock.calls[0][0] as { response_format?: { type: string } };
    expect(body.response_format?.type).toBe('json_schema');
  });

  it('retries when the model returns rambling text, and keeps the first valid label', async () => {
    chatCreate
      .mockResolvedValueOnce(
        reply('{"label":"el.. wait, no I need a label in spanish. Maybe I should"}')
      )
      .mockResolvedValueOnce(reply('{"label":"El Corazón"}'));
    const { step } = makeStep();
    await captured.handler!({ event, step });
    expect(chatCreate).toHaveBeenCalledTimes(2);
    expect(persistCall()!.label).toBe('El Corazón');
  });

  it('falls back to an empty label after repeated invalid output instead of saving junk', async () => {
    chatCreate.mockResolvedValue(reply('not json at all'));
    const { step } = makeStep();
    await captured.handler!({ event, step });
    expect(chatCreate).toHaveBeenCalledTimes(3);
    expect(persistCall()!.label).toBe('');
  });

  it('treats a truncated response as invalid', async () => {
    chatCreate
      .mockResolvedValueOnce(reply('{"label":"La', 'length'))
      .mockResolvedValueOnce(reply('{"label":"La Luna"}'));
    const { step } = makeStep();
    await captured.handler!({ event, step });
    expect(persistCall()!.label).toBe('La Luna');
  });
});

describe('generate-card-artwork AVIF uploads', () => {
  const reply = (content: string) => ({
    choices: [{ message: { content }, finish_reason: 'stop' }],
  });
  const asOriginal = (contentType: string) =>
    vi.mocked(fetchBlob).mockResolvedValue({ buffer: Buffer.from('raw'), contentType });

  afterEach(() => asOriginal('image/png'));

  const event = {
    data: { cardId: CARD, boardId: BOARD, userId: 'u1', originalImageUrl: 'https://blob/o.png' },
  };

  function imageUrlSent() {
    const body = chatCreate.mock.calls[0][0] as {
      messages: { content: string | { type: string; image_url?: { url: string } }[] }[];
    };
    const parts = body.messages[1].content as { type: string; image_url?: { url: string } }[];
    return parts.find((p) => p.type === 'image_url')!.image_url!.url;
  }

  it('converts AVIF to JPEG for labeling, since OpenAI vision cannot read AVIF', async () => {
    asOriginal('image/avif');
    chatCreate.mockResolvedValue(reply('{"label":"La Luna"}'));
    const { step } = makeStep();

    await captured.handler!({ event, step });

    expect(imageUrlSent()).toBe(
      `data:image/jpeg;base64,${Buffer.from('vision-jpeg').toString('base64')}`
    );
  });

  it('generates an illustration from an AVIF original', async () => {
    asOriginal('image/avif');
    chatCreate.mockResolvedValue(reply('{"label":"La Luna"}'));
    const { step } = makeStep();

    await captured.handler!({ event, step });

    expect(imagesEdit).toHaveBeenCalledOnce();
    expect(persistCall()!.illustrationUrl).toBe('https://blob/illustration.png');
  });

  it('still rejects formats sharp or browsers cannot handle', async () => {
    asOriginal('image/heic');
    const { step } = makeStep();

    await expect(
      captured.handler!({ event: { data: { ...event.data, skipLabeling: true } }, step })
    ).rejects.toThrow('Unsupported image format "image/heic"');
  });
});
