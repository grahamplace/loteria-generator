import { describe, it, expect, beforeEach, vi } from 'vitest';

const { responsesCreate } = vi.hoisted(() => ({ responsesCreate: vi.fn() }));

vi.mock('openai', () => ({
  default: vi.fn(() => ({ responses: { create: responsesCreate } })),
}));
vi.mock('@/lib/ai-tracing', () => ({
  withAITrace: (_name: string, _meta: unknown, fn: () => unknown) => fn(),
}));

import { detectSheet, extractSheet, toSheetDataUrl } from '@/lib/sheet-split-ai';
import sharp from 'sharp';

const meta = { userId: 'u1', boardId: 'b1', cardId: 'c1' };
const okResponse = (probability: number) => ({
  ok: true,
  status: 200,
  json: async () => ({ answers: [{ type: 'predicate', name: 'is_card_sheet', probability }] }),
});
const failResponse = () => ({
  ok: false,
  status: 500,
  json: async () => ({ error: { message: 'boom', type: 'server_error' } }),
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  responsesCreate.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('toSheetDataUrl', () => {
  it('returns a jpeg data url', async () => {
    const buf = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    expect(await toSheetDataUrl(buf)).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe('detectSheet', () => {
  it('detects a sheet at probability 1', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(1));
    expect(await detectSheet('data:image/jpeg;base64,AA', meta)).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-6-luna');
    expect(body.questions).toHaveLength(1);
    expect(body.questions[0].type).toBe('predicate');
  });

  it('returns false below threshold', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(0.5));
    expect(await detectSheet('data:x', meta)).toBe(false);
  });

  it('retries then succeeds', async () => {
    fetchMock.mockResolvedValueOnce(failResponse()).mockResolvedValueOnce(okResponse(1));
    expect(await detectSheet('data:x', meta)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns false after 3 failed attempts', async () => {
    fetchMock.mockResolvedValue(failResponse());
    expect(await detectSheet('data:x', meta)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('aborts a hung detection attempt and retries', async () => {
    const abortErr = Object.assign(new Error('The operation was aborted'), {
      name: 'TimeoutError',
    });
    fetchMock.mockRejectedValueOnce(abortErr).mockResolvedValueOnce(okResponse(1));
    expect(await detectSheet('data:x', meta)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('returns false when fetch throws every time', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    expect(await detectSheet('data:x', meta)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('extractSheet', () => {
  it('returns parsed cards', async () => {
    responsesCreate.mockResolvedValueOnce({
      output_text: JSON.stringify({
        rows: 1,
        cols: 1,
        cards: [
          {
            row: 1,
            col: 1,
            title: 'El Gallo',
            complete: true,
            box: { x0: 0, y0: 0, x1: 0.5, y1: 0.5 },
          },
        ],
      }),
    });
    const res = await extractSheet('data:x', meta);
    expect(res?.cards).toHaveLength(1);
    expect(res?.cards[0].title).toBe('El Gallo');
    expect(responsesCreate.mock.calls[0][0].model).toBe('gpt-6.1-sol');
  });

  it('passes a timeout to responses.create', async () => {
    responsesCreate.mockResolvedValueOnce({ output_text: '{}' });
    await extractSheet('data:x', meta);
    expect(responsesCreate.mock.calls[0][1]).toEqual({ timeout: 90000 });
  });

  it('returns null when the call throws', async () => {
    responsesCreate.mockRejectedValueOnce(new Error('nope'));
    expect(await extractSheet('data:x', meta)).toBeNull();
  });
});
