import { describe, it, expect } from 'vitest';
import {
  createJpegPageEncoder,
  dataUrlBytes,
  MIN_BUDGETED_JPEG_QUALITY,
  PDF_PAGE_JPEG_QUALITY,
} from '@/lib/pdf-page-budget';

const PREFIX = 'data:image/jpeg;base64,';

/** A fake canvas encoder: a page of `weight` bytes at quality 1, scaling linearly. */
function fakeEncode(weight: number, calls: number[] = []) {
  return (quality: number) => {
    calls.push(quality);
    const bytes = Math.round(weight * quality);
    return PREFIX + 'A'.repeat(Math.ceil(bytes / 3) * 4);
  };
}

describe('dataUrlBytes', () => {
  it('decodes the base64 payload length', () => {
    expect(dataUrlBytes(PREFIX + 'AAAA')).toBe(3);
    expect(dataUrlBytes(PREFIX + 'AAA=')).toBe(2);
    expect(dataUrlBytes(PREFIX + 'AA==')).toBe(1);
  });
});

describe('createJpegPageEncoder', () => {
  it('uses the default quality once with no budget', () => {
    const calls: number[] = [];
    const encode = createJpegPageEncoder({ pageCount: 3 });
    encode(fakeEncode(10_000, calls));
    expect(calls).toEqual([PDF_PAGE_JPEG_QUALITY]);
  });

  it('keeps the default quality when pages already fit', () => {
    const calls: number[] = [];
    const encode = createJpegPageEncoder({ maxBytes: 100_000, pageCount: 4 });
    for (let i = 0; i < 4; i++) encode(fakeEncode(10_000, calls));
    expect(new Set(calls)).toEqual(new Set([PDF_PAGE_JPEG_QUALITY]));
  });

  it('lowers quality until the pages fit the budget', () => {
    const pageCount = 10;
    const maxBytes = 60_000; // 6,000 a page; pages are 8,000 at the default quality
    const encode = createJpegPageEncoder({ maxBytes, pageCount });
    let total = 0;
    for (let i = 0; i < pageCount; i++) total += dataUrlBytes(encode(fakeEncode(10_000)));
    expect(total).toBeLessThanOrEqual(maxBytes);
    // Not needlessly low: within one quality step of the 6,000-byte share.
    expect(total).toBeGreaterThan(maxBytes * 0.9);
  });

  it('gives bytes a light page leaves unused to the pages after it', () => {
    const maxBytes = 20_000;
    const encode = createJpegPageEncoder({ maxBytes, pageCount: 2 });
    const light = dataUrlBytes(encode(fakeEncode(5_000))); // 4,000 at default quality
    const calls: number[] = [];
    // 15,200 at default quality: over an even 10,000 split, but fits the 16,000 left.
    const heavy = dataUrlBytes(encode(fakeEncode(19_000, calls)));
    expect(light + heavy).toBeLessThanOrEqual(maxBytes);
    expect(calls).toEqual([PDF_PAGE_JPEG_QUALITY]);
  });

  it('never goes below the quality floor, even if the page still does not fit', () => {
    const calls: number[] = [];
    const encode = createJpegPageEncoder({ maxBytes: 100, pageCount: 1 });
    encode(fakeEncode(1_000_000, calls));
    expect(Math.min(...calls)).toBe(MIN_BUDGETED_JPEG_QUALITY);
  });

  it('starts the next page near the last quality instead of re-walking from the top', () => {
    const encode = createJpegPageEncoder({ maxBytes: 50_000, pageCount: 10 });
    encode(fakeEncode(10_000));
    const calls: number[] = [];
    encode(fakeEncode(10_000, calls));
    expect(calls.length).toBeLessThanOrEqual(2);
  });
});
