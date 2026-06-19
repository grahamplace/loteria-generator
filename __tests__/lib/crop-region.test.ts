import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { cropExtractRegion, scaleRect, extractCrop } from '@/lib/crop-region';

describe('cropExtractRegion', () => {
  it('passes through an in-bounds rect as sharp extract params', () => {
    expect(cropExtractRegion({ x: 10, y: 20, width: 30, height: 40 }, 100, 100)).toEqual({
      left: 10,
      top: 20,
      width: 30,
      height: 40,
    });
  });

  it('clamps a rect that overflows the image', () => {
    expect(cropExtractRegion({ x: 90, y: 90, width: 50, height: 50 }, 100, 100)).toEqual({
      left: 90,
      top: 90,
      width: 10,
      height: 10,
    });
  });

  it('returns null for a degenerate rect', () => {
    expect(cropExtractRegion({ x: 100, y: 0, width: 10, height: 10 }, 100, 100)).toBeNull();
    expect(cropExtractRegion({ x: 0, y: 0, width: 0, height: 10 }, 100, 100)).toBeNull();
  });
});

describe('scaleRect', () => {
  it('scales and rounds', () => {
    expect(scaleRect({ x: 10, y: 20, width: 30, height: 40 }, 0.5)).toEqual({
      x: 5,
      y: 10,
      width: 15,
      height: 20,
    });
  });

  it('is identity at scale 1', () => {
    expect(scaleRect({ x: 1, y: 2, width: 3, height: 4 }, 1)).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
  });
});

describe('extractCrop', () => {
  it('crops a real image to the requested region size', async () => {
    const src = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const out = await extractCrop(src, { x: 10, y: 10, width: 40, height: 30 });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(30);
  });

  it('returns the source unchanged when the crop is degenerate', async () => {
    const src = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const out = await extractCrop(src, { x: 999, y: 0, width: 10, height: 10 });
    expect(out).toBe(src);
  });
});
