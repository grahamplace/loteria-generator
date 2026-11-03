import { describe, expect, it } from 'vitest';
import { estimateProgress, processingStage } from '@/lib/processing-progress';

describe('estimateProgress', () => {
  it('shows a sliver of progress immediately', () => {
    expect(estimateProgress(0)).toBeGreaterThan(0);
    expect(estimateProgress(-5_000)).toBe(estimateProgress(0));
  });

  it('is well past halfway when a typical card (~35s) lands', () => {
    expect(estimateProgress(35_000)).toBeGreaterThan(0.6);
    expect(estimateProgress(35_000)).toBeLessThan(0.8);
  });

  it('still has room left for slow cards (~90s)', () => {
    expect(estimateProgress(90_000)).toBeLessThan(0.95);
  });

  it('keeps rising but never completes on its own', () => {
    let prev = 0;
    for (const s of [5, 30, 60, 120, 300, 600, 3600]) {
      const p = estimateProgress(s * 1000);
      expect(p).toBeGreaterThanOrEqual(prev);
      expect(p).toBeLessThan(1);
      prev = p;
    }
  });
});

describe('processingStage', () => {
  it('advances through the stages over time', () => {
    expect(processingStage(0)).toBe('reading');
    expect(processingStage(8_000)).toBe('sketching');
    expect(processingStage(20_000)).toBe('painting');
    expect(processingStage(50_000)).toBe('finishing');
    expect(processingStage(120_000)).toBe('slow');
  });
});
