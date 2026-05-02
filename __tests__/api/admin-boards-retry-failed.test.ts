import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const selectMock = vi.fn();
const updateMock = vi.fn();
const returningMock = vi.fn();
const sendMock = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (...args: unknown[]) => selectMock(...args),
      }),
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: (...args: unknown[]) => {
          const result = updateMock(values, ...args);
          // For the forward UPDATE the route calls .returning(...).
          // For rollback UPDATEs the route awaits .where(...) directly.
          // Make `result` thenable AND have a .returning() method.
          return Object.assign(Promise.resolve(undefined), {
            returning: () => returningMock(),
          });
        },
      }),
    }),
  },
  cards: {
    id: 'cards.id',
    boardId: 'cards.boardId',
    status: 'cards.status',
    originalImageUrl: 'cards.originalImageUrl',
    errorMessage: 'cards.errorMessage',
    userId: 'cards.userId',
  },
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: (...args: unknown[]) => sendMock(...args) },
}));

import { auth } from '@/lib/auth';
import { POST } from '@/app/api/admin/boards/[id]/retry-failed/route';

const ADMIN_SESSION = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };

function makeReq() {
  return new Request('http://localhost/api/admin/boards/B1/retry-failed', { method: 'POST' });
}

const params = Promise.resolve({ id: 'board-1' });

describe('POST /api/admin/boards/[id]/retry-failed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as any);
    selectMock.mockResolvedValue([]);
    updateMock.mockResolvedValue(undefined);
    returningMock.mockResolvedValue([]);
    sendMock.mockResolvedValue(undefined);
  });

  it('returns 404 when caller is not admin', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { email: 'someone@example.com' },
    } as any);
    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(404);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 0 when there are no errored cards', async () => {
    selectMock.mockResolvedValue([]);
    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ retriedCount: 0, cardIds: [] });
    expect(updateMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('flips errored cards to processing, sends one event per card, returns count and ids', async () => {
    selectMock.mockResolvedValue([
      { id: 'c1', userId: 'u1', originalImageUrl: 'https://blob/x', errorMessage: 'boom' },
      { id: 'c2', userId: 'u1', originalImageUrl: 'https://blob/y', errorMessage: 'kaboom' },
    ]);
    returningMock.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ retriedCount: 2, cardIds: ['c1', 'c2'] });

    expect(updateMock).toHaveBeenCalledTimes(1);
    const [setValues] = updateMock.mock.calls[0];
    expect(setValues).toMatchObject({ status: 'processing', errorMessage: null });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [events] = sendMock.mock.calls[0];
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      name: 'card/illustration.regenerate',
      data: { cardId: 'c1', boardId: 'board-1', userId: 'u1', originalImageUrl: 'https://blob/x' },
    });
    expect(events[1].data.cardId).toBe('c2');
  });

  it('also retries cards stuck in processing whose updatedAt is past the staleness threshold', async () => {
    // The select mock doesn't enforce the WHERE clause, so we feed it the
    // same shape the route's SELECT would return for stuck-processing rows
    // (no errorMessage). The route should not care about the source status
    // — it just builds events from whatever the SELECT returns.
    selectMock.mockResolvedValue([
      { id: 'stuck-1', userId: 'u1', originalImageUrl: 'https://blob/x', errorMessage: null },
    ]);
    returningMock.mockResolvedValue([{ id: 'stuck-1' }]);

    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ retriedCount: 1, cardIds: ['stuck-1'] });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [events] = sendMock.mock.calls[0];
    expect(events[0]).toMatchObject({
      name: 'card/illustration.regenerate',
      data: { cardId: 'stuck-1', boardId: 'board-1' },
    });
  });

  it('returns 0 when another caller already flipped all errored cards (race)', async () => {
    selectMock.mockResolvedValue([
      { id: 'c1', userId: 'u1', originalImageUrl: 'https://blob/x', errorMessage: 'boom' },
    ]);
    returningMock.mockResolvedValue([]); // race: nothing was actually flipped
    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ retriedCount: 0, cardIds: [] });
    expect(updateMock).toHaveBeenCalledTimes(1); // forward UPDATE attempted
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rolls each card back to error with original errorMessage when inngest.send throws', async () => {
    selectMock.mockResolvedValue([
      { id: 'c1', userId: 'u1', originalImageUrl: 'https://blob/x', errorMessage: 'original-1' },
      { id: 'c2', userId: 'u1', originalImageUrl: 'https://blob/y', errorMessage: 'original-2' },
    ]);
    returningMock.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    sendMock.mockRejectedValue(new Error('inngest down'));

    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(500);

    // 1 forward UPDATE + N rollback UPDATEs (one per card to preserve original errorMessage)
    expect(updateMock).toHaveBeenCalledTimes(3);
    const rollback1 = updateMock.mock.calls[1][0];
    expect(rollback1).toMatchObject({ status: 'error', errorMessage: 'original-1' });
    const rollback2 = updateMock.mock.calls[2][0];
    expect(rollback2).toMatchObject({ status: 'error', errorMessage: 'original-2' });
  });
});
