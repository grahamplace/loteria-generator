import { describe, it, expect } from 'vitest';
import { needsFullReload } from '@/lib/cards/needs-full-reload';

describe('needsFullReload', () => {
  it('returns false when local and server have the same ids', () => {
    expect(needsFullReload(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('returns true when the server has a card the client lacks', () => {
    expect(needsFullReload(['a'], ['a', 'b'])).toBe(true);
  });

  it('returns true when the client has a card the server lacks', () => {
    expect(needsFullReload(['a', 'b'], ['a'])).toBe(true);
  });

  it('ignores temp- ids on the client', () => {
    expect(needsFullReload(['a', 'temp-x'], ['a'])).toBe(false);
  });
});
