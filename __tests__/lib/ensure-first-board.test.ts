import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_BOARD_NAME } from '@/lib/constants';

const { boardsFindMany, insertValuesSpy } = vi.hoisted(() => ({
  boardsFindMany: vi.fn(),
  insertValuesSpy: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      boards: { findMany: (...a: unknown[]) => boardsFindMany(...a) },
    },
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        insertValuesSpy(v);
        return {
          returning: () => Promise.resolve([{ id: 'new-board', ...v }]),
          onConflictDoNothing: () => Promise.resolve([]),
        };
      },
    }),
  },
  boards: {},
  userProfiles: {},
}));

import { ensureFirstBoard } from '@/lib/boards/ensure-first-board';

const USER = { id: 'user-1', email: 'user@example.com' };
const ADMIN = { id: 'admin-1', email: 'graham@stonecutterlabs.com' };

function boardInsertCall() {
  return insertValuesSpy.mock.calls.map((c) => c[0]).find((v) => 'name' in v);
}

function profileInsertCall() {
  return insertValuesSpy.mock.calls.map((c) => c[0]).find((v) => !('name' in v));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureFirstBoard', () => {
  it('returns the most recent existing board without creating one', async () => {
    boardsFindMany.mockResolvedValue([{ id: 'board-newest' }, { id: 'board-older' }]);

    const result = await ensureFirstBoard(USER);

    expect(result).toEqual({ boardId: 'board-newest', created: false });
    expect(insertValuesSpy).not.toHaveBeenCalled();
  });

  it('creates a default-named locked board for a new non-admin user', async () => {
    boardsFindMany.mockResolvedValue([]);

    const result = await ensureFirstBoard(USER);

    expect(result).toEqual({ boardId: 'new-board', created: true });
    expect(boardInsertCall()).toMatchObject({
      userId: 'user-1',
      name: DEFAULT_BOARD_NAME,
      isUnlocked: false,
    });
  });

  it('creates an unlocked board for a new admin user', async () => {
    boardsFindMany.mockResolvedValue([]);

    const result = await ensureFirstBoard(ADMIN);

    expect(result.created).toBe(true);
    expect(boardInsertCall()).toMatchObject({ isUnlocked: true });
  });

  it('upserts the user profile before creating the board', async () => {
    boardsFindMany.mockResolvedValue([]);

    await ensureFirstBoard(USER);

    // Two inserts happened: the profile ({ id }) and the board ({ name, ... }).
    expect(profileInsertCall()).toEqual({ id: 'user-1' });
    expect(boardInsertCall()).toBeDefined();
  });
});
