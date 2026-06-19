import { describe, it, expect } from 'vitest';
import { scaleCropToNatural } from '@/lib/crop-image';

describe('scaleCropToNatural', () => {
  it('scales a display-pixel crop up to natural pixels', () => {
    const rect = scaleCropToNatural(
      { x: 20, y: 30, width: 100, height: 150 },
      { naturalWidth: 1000, naturalHeight: 1500, displayWidth: 200, displayHeight: 300 }
    );
    expect(rect).toEqual({ x: 100, y: 150, width: 500, height: 750 });
  });

  it('is identity when display equals natural', () => {
    const rect = scaleCropToNatural(
      { x: 10, y: 10, width: 40, height: 60 },
      { naturalWidth: 100, naturalHeight: 100, displayWidth: 100, displayHeight: 100 }
    );
    expect(rect).toEqual({ x: 10, y: 10, width: 40, height: 60 });
  });

  it('rounds fractional results', () => {
    const rect = scaleCropToNatural(
      { x: 1, y: 1, width: 33, height: 33 },
      { naturalWidth: 333, naturalHeight: 333, displayWidth: 100, displayHeight: 100 }
    );
    expect(rect.width).toBe(110);
    expect(rect.height).toBe(110);
  });

  it('clamps width/height so the rect stays within the image', () => {
    const rect = scaleCropToNatural(
      { x: 90, y: 90, width: 50, height: 50 },
      { naturalWidth: 100, naturalHeight: 100, displayWidth: 100, displayHeight: 100 }
    );
    expect(rect.x).toBe(90);
    expect(rect.width).toBe(10);
    expect(rect.height).toBe(10);
  });
});
