import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordReillustrate, REPEAT_WINDOW_MS } from '@/lib/reillustrate-repeat';

describe('recordReillustrate', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('returns null the first time a card is re-illustrated', () => {
    expect(recordReillustrate('card-a', 1_000_000)).toBeNull();
  });

  it('returns whole seconds since the previous re-illustrate of the same card', () => {
    recordReillustrate('card-a', 1_000_000);
    expect(recordReillustrate('card-a', 1_095_400)).toBe(95);
  });

  it('tracks cards independently', () => {
    recordReillustrate('card-a', 1_000_000);
    expect(recordReillustrate('card-b', 1_050_000)).toBeNull();
  });

  it('measures from the latest re-illustrate', () => {
    recordReillustrate('card-a', 1_000_000);
    recordReillustrate('card-a', 1_060_000);
    expect(recordReillustrate('card-a', 1_090_000)).toBe(30);
  });

  it('returns null when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(recordReillustrate('card-a', 1_000_000)).toBeNull();
  });

  it('uses a 10 minute repeat window', () => {
    expect(REPEAT_WINDOW_MS).toBe(10 * 60 * 1000);
  });
});
