import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lazyClient, requireEnv } from '@/lib/lazy-client';

describe('lazyClient', () => {
  it('should not invoke the factory until the client is touched', () => {
    const create = vi.fn(() => ({ value: 1 }));

    lazyClient(create);

    expect(create).not.toHaveBeenCalled();
  });

  it('should invoke the factory on first property access', () => {
    const create = vi.fn(() => ({ value: 1 }));
    const client = lazyClient(create);

    expect(client.value).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('should construct the client only once across many accesses', () => {
    const create = vi.fn(() => ({ value: 1 }));
    const client = lazyClient(create);

    void client.value;
    void client.value;
    void client.value;

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('should bind methods to the real client, not the proxy', () => {
    const client = lazyClient(() => ({
      name: 'real',
      whoAmI(this: { name: string }) {
        return this.name;
      },
    }));

    // Destructuring drops `this`, which is how these clients are often used
    // (e.g. passing a method as a callback). The cast reflects that: TypeScript
    // rejects the standalone call, and it only works because the proxy binds.
    const whoAmI = client.whoAmI as () => string;

    expect(whoAmI()).toBe('real');
  });

  it('should forward nested namespace access', () => {
    const client = lazyClient(() => ({ checkout: { sessions: { create: () => 'session' } } }));

    expect(client.checkout.sessions.create()).toBe('session');
  });

  it('should surface a factory error at the point of use', () => {
    const client = lazyClient<{ value: number }>(() => {
      throw new Error('missing secret');
    });

    expect(() => client.value).toThrow('missing secret');
  });

  it('should support the `in` operator and Object.keys without throwing', () => {
    const client = lazyClient(() => ({ alpha: 1, beta: 2 }));

    expect('alpha' in client).toBe(true);
    expect('gamma' in client).toBe(false);
    expect(Object.keys(client).sort()).toEqual(['alpha', 'beta']);
  });
});

describe('requireEnv', () => {
  const ORIGINAL = process.env.SOME_TEST_SECRET;

  beforeEach(() => {
    delete process.env.SOME_TEST_SECRET;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SOME_TEST_SECRET;
    else process.env.SOME_TEST_SECRET = ORIGINAL;
  });

  it('should return the value when set', () => {
    process.env.SOME_TEST_SECRET = 'abc';

    expect(requireEnv('SOME_TEST_SECRET', 'the test client')).toBe('abc');
  });

  it('should name both the variable and its consumer when unset', () => {
    expect(() => requireEnv('SOME_TEST_SECRET', 'the test client')).toThrow(
      'SOME_TEST_SECRET is not set — required by the test client.'
    );
  });

  it('should treat an empty string as unset', () => {
    process.env.SOME_TEST_SECRET = '';

    expect(() => requireEnv('SOME_TEST_SECRET', 'the test client')).toThrow('is not set');
  });
});
