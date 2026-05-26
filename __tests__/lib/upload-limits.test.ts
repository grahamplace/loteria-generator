import { describe, it, expect } from 'vitest';
import { partitionBySize, MAX_UPLOAD_BYTES } from '@/lib/upload-limits';

const file = (name: string, size: number) => ({ name, size });

describe('partitionBySize', () => {
  it('keeps files at or under the limit and flags those over it', () => {
    const small = file('small.jpg', 500);
    const exact = file('exact.jpg', 100);
    const big = file('big.png', 2000);

    const { valid, oversized } = partitionBySize([small, exact, big], 1000);

    expect(valid).toEqual([small, exact]);
    expect(oversized).toEqual([big]);
  });

  it('treats a file exactly at the limit as valid', () => {
    const { valid, oversized } = partitionBySize([file('edge.jpg', 1000)], 1000);
    expect(valid).toHaveLength(1);
    expect(oversized).toHaveLength(0);
  });

  it('preserves original order within each bucket', () => {
    const a = file('a', 10);
    const b = file('b', 999);
    const c = file('c', 5);
    const d = file('d', 1000);

    const { valid, oversized } = partitionBySize([a, b, c, d], 100);

    expect(valid).toEqual([a, c]);
    expect(oversized).toEqual([b, d]);
  });

  it('returns empty buckets for an empty input', () => {
    expect(partitionBySize([], 100)).toEqual({ valid: [], oversized: [] });
  });

  it('defaults to the platform-safe upload limit', () => {
    const underLimit = file('ok.jpg', MAX_UPLOAD_BYTES);
    const overLimit = file('huge.jpg', MAX_UPLOAD_BYTES + 1);

    const { valid, oversized } = partitionBySize([underLimit, overLimit]);

    expect(valid).toEqual([underLimit]);
    expect(oversized).toEqual([overLimit]);
  });
});
