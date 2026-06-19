import { describe, it, expect } from 'vitest';
import { computeDownscaleDimensions } from '@/lib/downscale-image';

describe('computeDownscaleDimensions', () => {
  it('scales the longest side down to max, preserving aspect', () => {
    expect(computeDownscaleDimensions(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
  });

  it('scales by height when portrait', () => {
    expect(computeDownscaleDimensions(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it('never upscales', () => {
    expect(computeDownscaleDimensions(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it('rounds to whole pixels', () => {
    expect(computeDownscaleDimensions(2049, 1000, 2048)).toEqual({ width: 2048, height: 999 });
  });
});
