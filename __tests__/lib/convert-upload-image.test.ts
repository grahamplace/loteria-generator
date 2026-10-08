import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';

const { heicTo } = vi.hoisted(() => ({ heicTo: vi.fn() }));
vi.mock('heic-to/csp', () => ({ heicTo }));

import {
  convertForUpload,
  convertibleKind,
  isUploadCandidate,
  CONVERTIBLE_IMAGE_ACCEPT,
} from '@/lib/convert-upload-image';

function file(name: string, type: string) {
  return new File([new Uint8Array([1, 2, 3])], name, { type, lastModified: 42 });
}

describe('convertibleKind', () => {
  it.each([
    ['IMG_0001.HEIC', 'image/heic', 'heic'],
    ['IMG_0001.heif', 'image/heif', 'heic'],
    // Chrome/Firefox often report no MIME type for HEIC.
    ['IMG_0001.HEIC', '', 'heic'],
    ['scan.tif', 'image/tiff', 'tiff'],
    ['scan.TIFF', '', 'tiff'],
    ['photo.jpg', 'image/jpeg', null],
    ['photo.avif', 'image/avif', null],
  ])('%s (%s) → %s', (name, type, kind) => {
    expect(convertibleKind({ name, type })).toBe(kind);
  });
});

describe('isUploadCandidate', () => {
  it('accepts images and type-less HEIC/TIFF, rejects other files', () => {
    expect(isUploadCandidate({ name: 'a.png', type: 'image/png' })).toBe(true);
    expect(isUploadCandidate({ name: 'a.heic', type: '' })).toBe(true);
    expect(isUploadCandidate({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
    expect(isUploadCandidate({ name: 'mystery', type: '' })).toBe(false);
  });
});

describe('CONVERTIBLE_IMAGE_ACCEPT', () => {
  it('lists extensions so pickers show type-less HEIC/TIFF files', () => {
    expect(CONVERTIBLE_IMAGE_ACCEPT.split(',')).toEqual(
      expect.arrayContaining(['.heic', '.heif', '.tif', '.tiff'])
    );
  });
});

describe('convertForUpload', () => {
  const drawImage = vi.fn();
  const fakeBitmap = { width: 6000, height: 4000, close: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb) {
      cb(new Blob(['jpeg'], { type: 'image/jpeg' }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns non-convertible files untouched', async () => {
    const original = file('photo.jpg', 'image/jpeg');
    expect(await convertForUpload(original)).toBe(original);
  });

  it('uses the native decoder when the browser has one (Safari)', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => fakeBitmap)
    );

    const out = await convertForUpload(file('IMG_0001.HEIC', 'image/heic'));

    expect(heicTo).not.toHaveBeenCalled();
    expect(out.name).toBe('IMG_0001.jpg');
    expect(out.type).toBe('image/jpeg');
    expect(out.lastModified).toBe(42);
  });

  it('falls back to libheif for HEIC when native decode fails, and downscales', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new DOMException('unsupported', 'InvalidStateError');
      })
    );
    heicTo.mockResolvedValue(fakeBitmap);

    const out = await convertForUpload(file('IMG_0001.HEIC', ''));

    expect(heicTo).toHaveBeenCalledWith(expect.objectContaining({ type: 'bitmap' }));
    // 6000×4000 → longest side capped at 3000.
    expect(drawImage).toHaveBeenCalledWith(fakeBitmap, 0, 0, 3000, 2000);
    expect(fakeBitmap.close).toHaveBeenCalled();
    expect(out.type).toBe('image/jpeg');
  });

  it('decodes TIFF with UTIF when native decode fails, taking the full-size page', async () => {
    const tiff = await sharp({
      create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .tiff({ compression: 'lzw' })
      .toBuffer();
    class FakeImageData {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number
      ) {}
    }
    vi.stubGlobal('ImageData', FakeImageData);
    const decoded: FakeImageData[] = [];
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async (src: unknown) => {
        if (!(src instanceof FakeImageData)) throw new DOMException('no', 'InvalidStateError');
        decoded.push(src);
        return { width: src.width, height: src.height, close: vi.fn() };
      })
    );

    const input = new File([new Uint8Array(tiff)], 'scan.tiff', { type: 'image/tiff' });
    // jsdom's File lacks arrayBuffer(); real browsers have it.
    const bytes = new Uint8Array(tiff);
    Object.defineProperty(input, 'arrayBuffer', {
      value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });

    const out = await convertForUpload(input);

    expect(decoded[0].width).toBe(40);
    expect(decoded[0].height).toBe(20);
    // First pixel survives the decode as RGBA.
    expect(Array.from(decoded[0].data.slice(0, 4))).toEqual([200, 100, 50, 255]);
    expect(out.name).toBe('scan.jpg');
  });

  it('throws when the file cannot be decoded at all', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new DOMException('unsupported', 'InvalidStateError');
      })
    );
    heicTo.mockRejectedValue(new Error('corrupt'));

    await expect(convertForUpload(file('broken.heic', 'image/heic'))).rejects.toThrow('corrupt');
  });
});
