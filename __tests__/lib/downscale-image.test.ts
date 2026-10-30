import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDownscaleDimensions, downscaleToDataUrl } from '@/lib/downscale-image';
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits';

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

describe('downscaleToDataUrl', () => {
  const ctx = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    globalCompositeOperation: '',
    fillStyle: '',
  };
  const toDataURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 1320, height: 2868, close: vi.fn() }))
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      (type?: string) => toDataURL(type) as string
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const png = new File(['x'], 'screenshot.png', { type: 'image/png' });

  it('keeps a PNG that fits', async () => {
    toDataURL.mockReturnValue('data:image/png;base64,AAAA');

    const { dataUrl } = await downscaleToDataUrl(png, 2048);

    expect(dataUrl).toBe('data:image/png;base64,AAAA');
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('falls back to JPEG on white when the re-encoded PNG is too big to upload', async () => {
    toDataURL.mockImplementation((type: string) =>
      type === 'image/png'
        ? `data:image/png;base64,${'A'.repeat((MAX_UPLOAD_BYTES * 4) / 3 + 100)}`
        : 'data:image/jpeg;base64,BBBB'
    );

    const { dataUrl } = await downscaleToDataUrl(png, 2048);

    expect(dataUrl).toBe('data:image/jpeg;base64,BBBB');
    // Painted behind the existing pixels so transparent areas turn white, not black.
    expect(ctx.globalCompositeOperation).toBe('destination-over');
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 942, 2048);
  });
});
