import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';

const { heicTo } = vi.hoisted(() => ({ heicTo: vi.fn() }));
vi.mock('heic-to/csp', () => ({ heicTo }));

import {
  convertForUpload,
  convertibleKind,
  isUploadCandidate,
  needsConversion,
  sniffConvertibleKind,
  CONVERTIBLE_IMAGE_ACCEPT,
} from '@/lib/convert-upload-image';
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits';

function file(name: string, type: string, size = 3) {
  return new File([new Uint8Array(size)], name, { type, lastModified: 42 });
}

const OVER_CAP = MAX_UPLOAD_BYTES + 1;

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

/** A File whose bytes start with `header`, padded with zeros. */
function fileWithHeader(name: string, type: string, header: number[] | string) {
  const head = typeof header === 'string' ? Array.from(header, (c) => c.charCodeAt(0)) : header;
  const bytes = new Uint8Array(64);
  bytes.set(head);
  return new File([bytes], name, { type, lastModified: 42 });
}

const HEIC_HEADER = '\0\0\0\x18ftypheic';

describe('sniffConvertibleKind', () => {
  it.each([
    ['iPhone HEIC', HEIC_HEADER, 'heic'],
    ['HEIF image', '\0\0\0\x1cftypmif1', 'heic'],
    ['little-endian TIFF', 'II*\0', 'tiff'],
    ['big-endian TIFF', 'MM\0*', 'tiff'],
    ['AVIF', '\0\0\0\x1cftypavif', null],
    ['JPEG', [0xff, 0xd8, 0xff, 0xe0], null],
    ['PNG', [0x89, 0x50, 0x4e, 0x47], null],
  ])('%s → %s', async (_, header, kind) => {
    expect(await sniffConvertibleKind(fileWithHeader('photo.jpg', 'image/jpeg', header))).toBe(
      kind
    );
  });

  it('returns null for a file shorter than a header', async () => {
    expect(await sniffConvertibleKind(new File([new Uint8Array(2)], 'a.jpg'))).toBeNull();
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

describe('needsConversion', () => {
  it('converts HEIC/TIFF at any size and shrinks readable photos only over the cap', () => {
    expect(needsConversion({ name: 'a.heic', type: '', size: 10 })).toBe(true);
    expect(needsConversion({ name: 'a.jpg', type: 'image/jpeg', size: 10 })).toBe(false);
    expect(needsConversion({ name: 'a.jpg', type: 'image/jpeg', size: OVER_CAP })).toBe(true);
    expect(needsConversion({ name: 'a.png', type: 'image/png', size: OVER_CAP })).toBe(true);
    // Re-encoding a GIF would drop its animation.
    expect(needsConversion({ name: 'a.gif', type: 'image/gif', size: OVER_CAP })).toBe(false);
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
  const fillRect = vi.fn();
  const fakeBitmap = { width: 6000, height: 4000, close: vi.fn() };
  const toBlob = vi.fn((cb: BlobCallback) => cb(new Blob(['jpeg'], { type: 'image/jpeg' })));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      fillRect,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb) {
      toBlob(cb);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns photos under the cap untouched', async () => {
    const original = file('photo.jpg', 'image/jpeg');
    expect(await convertForUpload(original)).toBe(original);
  });

  it('shrinks a photo over the cap to a 3000px JPEG on a white background', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => fakeBitmap)
    );

    const out = await convertForUpload(file('IMG_4821.PNG', 'image/png', OVER_CAP));

    expect(fillRect).toHaveBeenCalledWith(0, 0, 3000, 2000);
    expect(drawImage).toHaveBeenCalledWith(fakeBitmap, 0, 0, 3000, 2000);
    expect(out.name).toBe('IMG_4821.jpg');
    expect(out.type).toBe('image/jpeg');
    expect(fakeBitmap.close).toHaveBeenCalled();
  });

  it('steps down in size until the JPEG fits under the cap', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => fakeBitmap)
    );
    toBlob
      .mockImplementationOnce((cb) => cb(new Blob([new Uint8Array(OVER_CAP)])))
      .mockImplementationOnce((cb) => cb(new Blob(['fits'], { type: 'image/jpeg' })));

    const out = await convertForUpload(file('detailed.jpg', 'image/jpeg', OVER_CAP));

    expect(drawImage).toHaveBeenLastCalledWith(fakeBitmap, 0, 0, 2400, 1600);
    expect(out.size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
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

  it('converts a HEIC photo renamed to .jpg, even under the cap', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new DOMException('unsupported', 'InvalidStateError');
      })
    );
    heicTo.mockResolvedValue(fakeBitmap);

    const out = await convertForUpload(
      fileWithHeader('La Bisabuela.jpg', 'image/jpeg', HEIC_HEADER)
    );

    expect(heicTo).toHaveBeenCalled();
    expect(out.name).toBe('La Bisabuela.jpg');
    expect(out.type).toBe('image/jpeg');
    expect(out.size).toBe(4); // the re-encoded JPEG, not the original bytes
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
