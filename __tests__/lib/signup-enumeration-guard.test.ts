import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  assertSignUpEmailIsAvailable,
  GENERIC_SIGN_UP_ERROR_CODE,
} from '@/lib/signup-enumeration-guard';

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('assertSignUpEmailIsAvailable', () => {
  it('lets an unused address through', async () => {
    const find = vi.fn().mockResolvedValue(null);
    await expect(assertSignUpEmailIsAvailable('new@example.com', find)).resolves.toBeUndefined();
    expect(find).toHaveBeenCalledWith('new@example.com');
  });

  it('lowercases the address before looking it up, matching better-auth', async () => {
    const find = vi.fn().mockResolvedValue(null);
    await assertSignUpEmailIsAvailable('  New@Example.COM ', find);
    expect(find).toHaveBeenCalledWith('new@example.com');
  });

  it('throws a neutral error for an address that already has an account', async () => {
    const find = vi.fn().mockResolvedValue({ user: { id: 'u1' } });
    const error = await assertSignUpEmailIsAvailable('taken@example.com', find).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.body?.code).toBe(GENERIC_SIGN_UP_ERROR_CODE);
    // The whole point: the response must not name the cause.
    expect(JSON.stringify(error.body)).not.toMatch(/already exists/i);
    expect(JSON.stringify(error.body)).not.toMatch(/another email/i);
  });

  it('ignores a non-string or empty email and lets better-auth validate', async () => {
    const find = vi.fn();
    await expect(assertSignUpEmailIsAvailable(undefined, find)).resolves.toBeUndefined();
    await expect(assertSignUpEmailIsAvailable('   ', find)).resolves.toBeUndefined();
    await expect(assertSignUpEmailIsAvailable(42, find)).resolves.toBeUndefined();
    expect(find).not.toHaveBeenCalled();
  });

  it('fails open when the lookup throws', async () => {
    const find = vi.fn().mockRejectedValue(new Error('db down'));
    await expect(assertSignUpEmailIsAvailable('a@example.com', find)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
