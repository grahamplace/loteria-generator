import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  find: vi.fn(),
  set: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock('@/lib/admin', () => ({ getAdminSession: mocks.session }));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: mocks.invalidate }));
vi.mock('@/db', () => ({
  boards: { id: 'id' },
  db: {
    query: { boards: { findFirst: mocks.find } },
    update: () => ({
      set: (values: unknown) => {
        mocks.set(values);
        return {
          where: () => ({ returning: async () => [{ id: 'board', ...(values as object) }] }),
        };
      },
    }),
  },
}));
import { PATCH } from '@/app/api/admin/boards/[id]/settings/route';
const params = Promise.resolve({ id: 'board' });
const request = (body: unknown) =>
  new Request('http://localhost/settings', { method: 'PATCH', body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: 'admin' } });
  mocks.find.mockResolvedValue({
    id: 'board',
    userId: 'owner',
    styleOptions: { labelColor: '#123456' },
  });
});
describe('admin board settings', () => {
  it('stores and restores the board custom design through preset changes', async () => {
    mocks.find.mockResolvedValue({
      id: 'board',
      userId: 'owner',
      styleOptions: {
        presetId: 'custom',
        backgroundColor: '#123456',
        font: 'Caveat',
        borderStyle: 'dashed',
      },
    });
    const switched = await PATCH(request({ styleOptions: { presetId: 'wedding' } }), { params });
    const saved = (await switched.json()).board;
    expect(saved.styleOptions.customDesign).toEqual({
      backgroundColor: '#123456',
      font: 'Caveat',
      borderStyle: 'dashed',
    });
    mocks.find.mockResolvedValue({ ...saved, userId: 'owner' });
    const restored = await PATCH(request({ styleOptions: { presetId: 'custom' } }), { params });
    expect((await restored.json()).board.styleOptions).toMatchObject({
      presetId: 'custom',
      backgroundColor: '#123456',
      font: 'Caveat',
      borderStyle: 'dashed',
    });
  });
  it('saves custom colors, typography and borders through the admin endpoint', async () => {
    const styleOptions = {
      presetId: 'custom',
      backgroundColor: '#123456',
      numberColor: '#abcdef',
      font: 'Caveat',
      borderStyle: 'double',
      borderColor: '#fedcba',
    };
    const response = await PATCH(request({ styleOptions }), { params });
    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        styleOptions: {
          labelColor: '#123456',
          ...styleOptions,
          customDesign: {
            labelColor: '#123456',
            backgroundColor: '#123456',
            numberColor: '#abcdef',
            font: 'Caveat',
            borderStyle: 'double',
            borderColor: '#fedcba',
          },
        },
      })
    );
  });
  it('conceals settings from non-admins', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await PATCH(request({ photoMode: 'original' }), { params })).status).toBe(404);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it('rejects unsupported theme IDs', async () => {
    expect(
      (await PATCH(request({ styleOptions: { presetId: 'unknown' } }), { params })).status
    ).toBe(400);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it('persists the shared preset, title and photo mode without stale colors', async () => {
    const response = await PATCH(
      request({
        styleOptions: {
          presetId: 'halloween',
          showTitle: true,
        },
        photoMode: 'original',
      }),
      { params }
    );
    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        photoMode: 'original',
        styleOptions: {
          presetId: 'halloween',
          showTitle: true,
          customDesign: { labelColor: '#123456' },
        },
      })
    );
    expect(mocks.invalidate).toHaveBeenCalledWith('board', 'owner');
  });
});
