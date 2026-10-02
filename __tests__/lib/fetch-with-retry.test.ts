import { describe, it, expect, vi } from 'vitest';
import { fetchWithRetry } from '@/lib/fetch-with-retry';

const ok = { ok: true, status: 201 } as Response;
const networkError = () => new TypeError('Failed to fetch');

describe('fetchWithRetry', () => {
  it('returns the first response when the request goes through', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('/x', { method: 'POST' }, { delaysMs: [0, 0] })).resolves.toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/x', { method: 'POST' });
  });

  it('retries a dropped connection and returns the response that gets through', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce(ok);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('/x', undefined, { delaysMs: [0, 0] })).resolves.toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws the last network error once every retry is used', async () => {
    const fetchMock = vi.fn().mockRejectedValue(networkError());
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('/x', undefined, { delaysMs: [0, 0] })).rejects.toThrow(
      'Failed to fetch'
    );
    // One first try plus one retry per delay.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry an HTTP error response', async () => {
    const serverError = { ok: false, status: 500 } as Response;
    const fetchMock = vi.fn().mockResolvedValueOnce(serverError);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('/x', undefined, { delaysMs: [0, 0] })).resolves.toBe(serverError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry an abort', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    const fetchMock = vi.fn().mockRejectedValueOnce(abort);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('/x', undefined, { delaysMs: [0, 0] })).rejects.toBe(abort);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits the given delay before each retry', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn().mockRejectedValueOnce(networkError()).mockResolvedValueOnce(ok);
      vi.stubGlobal('fetch', fetchMock);

      const pending = fetchWithRetry('/x', undefined, { delaysMs: [1000] });
      await vi.advanceTimersByTimeAsync(999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toBe(ok);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
