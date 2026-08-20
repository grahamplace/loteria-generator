import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The "never 0 boards" invariant lives in a better-auth
 * `databaseHooks.user.create.after` hook, so a board exists the instant the user
 * row does — no redirect required.
 *
 * better-auth runs `create.after` inline in the signup request and re-throws
 * whatever the hook throws (better-auth 1.6.9: `db/with-hooks.mjs` awaits it,
 * `context/transaction.mjs` re-raises). So the hook must swallow its own
 * failures: a missing board is repaired at `/start`, a failed signup is not.
 */

const { ensureFirstBoard } = vi.hoisted(() => ({
  ensureFirstBoard: vi.fn(),
}));

vi.mock('@/lib/boards/ensure-first-board', () => ({
  ensureFirstBoard: (...args: unknown[]) => ensureFirstBoard(...args),
}));

vi.mock('@/db', () => ({
  db: {},
  boards: {},
  userProfiles: {},
}));

vi.mock('@/db/schema', () => ({
  user: {},
  session: {},
  account: {},
  verification: {},
}));

import { auth, createFirstBoardForNewUser } from '@/lib/auth';

const NEW_USER = { id: 'user-42', email: 'new@example.com' };

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  ensureFirstBoard.mockResolvedValue({ boardId: 'board-1', created: true, boardCount: 1 });
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('createFirstBoardForNewUser', () => {
  it('creates a board for the new user', async () => {
    await createFirstBoardForNewUser(NEW_USER);

    expect(ensureFirstBoard).toHaveBeenCalledTimes(1);
    expect(ensureFirstBoard).toHaveBeenCalledWith({
      id: 'user-42',
      email: 'new@example.com',
    });
  });

  it('resolves instead of throwing when the board insert fails', async () => {
    ensureFirstBoard.mockRejectedValue(new Error('db is down'));

    await expect(createFirstBoardForNewUser(NEW_USER)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});

describe('auth databaseHooks wiring', () => {
  it('registers the board creator on user.create.after', async () => {
    const after = auth.options.databaseHooks?.user?.create?.after;
    expect(after).toBeTypeOf('function');

    await after?.({ ...NEW_USER } as Parameters<NonNullable<typeof after>>[0]);

    expect(ensureFirstBoard).toHaveBeenCalledWith({
      id: 'user-42',
      email: 'new@example.com',
    });
  });

  it('does not reject signup when the hook fails', async () => {
    ensureFirstBoard.mockRejectedValue(new Error('db is down'));
    const after = auth.options.databaseHooks?.user?.create?.after;

    await expect(
      after?.({ ...NEW_USER } as Parameters<NonNullable<typeof after>>[0])
    ).resolves.toBeUndefined();
  });
});
