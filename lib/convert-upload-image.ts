import { computeDownscaleDimensions } from '@/lib/downscale-image';
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits';

/**
 * Browser-side conversion at selection time:
 * - Formats the rest of the pipeline can't read (see `lib/image-formats.ts`),
 *   HEIC/HEIF (iPhone photos) and TIFF, are re-encoded as JPEG, so previews,
 *   uploads, the server and PDF exports only ever see a format every browser
 *   and sharp can decode.
 * - Readable photos over the upload cap are shrunk to a JPEG that fits. iOS
 *   hands Safari full-size JPEGs from the photo library, often 4–12MB.
 * - The name and MIME type can lie: an iPhone photo renamed to `.jpg` is still
 *   HEIC inside, and the browser reports `image/jpeg` from the extension. The
 *   first bytes are checked too, so those get converted instead of failing on
 *   the server.
 */

export type ConvertibleKind = 'heic' | 'tiff';

const HEIC_MIME = /^image\/hei[cf](-sequence)?$/i;
const HEIC_EXT = /\.hei[cf]$/i;
const TIFF_MIME = /^image\/tiff?$/i;
const TIFF_EXT = /\.tiff?$/i;

/** Extra `accept` entries for convertible formats. Extensions are listed too:
 * Chrome and Firefox often report an empty MIME type for HEIC. */
export const CONVERTIBLE_IMAGE_ACCEPT = 'image/heic,image/heif,.heic,.heif,image/tiff,.tif,.tiff';

/**
 * Longest side and JPEG quality for each encode attempt, best first. 3000px
 * keeps a typical photo well under the upload cap while staying far above
 * print resolution for a card; the smaller steps catch unusually detailed
 * photos that still don't fit.
 */
const ENCODE_STEPS = [
  [3000, 0.88],
  [2400, 0.85],
  [2000, 0.8],
] as const;

/** Readable formats worth shrinking. GIF is left alone: re-encoding drops its animation. */
const SHRINKABLE_MIME = /^image\/(jpeg|png|webp|avif)$/i;

export function convertibleKind(file: Pick<File, 'name' | 'type'>): ConvertibleKind | null {
  if (HEIC_MIME.test(file.type) || HEIC_EXT.test(file.name)) return 'heic';
  if (TIFF_MIME.test(file.type) || TIFF_EXT.test(file.name)) return 'tiff';
  return null;
}

/** True for anything the upload flow can take, before or after conversion. */
export function isUploadCandidate(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type.startsWith('image/') || convertibleKind(file) !== null;
}

/** True if `convertForUpload` will re-encode the file (slow enough to show progress). */
export function needsConversion(file: Pick<File, 'name' | 'type' | 'size'>): boolean {
  return (
    convertibleKind(file) !== null ||
    (file.size > MAX_UPLOAD_BYTES && SHRINKABLE_MIME.test(file.type))
  );
}

/** ISO-BMFF brands (bytes 8–11) of HEIC/HEIF stills and sequences. AVIF uses
 * `avif`/`avis`, which browsers decode natively, so it is left out. */
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

/**
 * Detects HEIC/HEIF and TIFF from the file's first bytes, for files whose name
 * and MIME type claim something else. Returns null if the header matches
 * neither or can't be read.
 */
export async function sniffConvertibleKind(file: Blob): Promise<ConvertibleKind | null> {
  let bytes: Uint8Array;
  try {
    bytes = await readBytes(file.slice(0, 12));
  } catch {
    return null;
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 12 && ascii(4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(8, 12))) return 'heic';
  const head = ascii(0, 4);
  if (head === 'II*\0' || head === 'MM\0*') return 'tiff';
  return null;
}

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Returns `file` unchanged if it needs no conversion, otherwise a JPEG `File`
 * with the same base name (filename-derived labels stay the same). Throws if
 * the file can't be decoded. A result can still exceed the upload cap if even
 * the smallest step doesn't fit; the size check after this rejects it.
 */
export async function convertForUpload(file: File): Promise<File> {
  const kind = convertibleKind(file) ?? (await sniffConvertibleKind(file));
  if (!kind && !needsConversion(file)) return file;

  const bitmap = kind ? await decode(file, kind) : await createImageBitmap(file);
  try {
    let blob: Blob | null = null;
    for (const [maxDimension, quality] of ENCODE_STEPS) {
      blob = await encodeJpeg(bitmap, maxDimension, quality);
      if (blob.size <= MAX_UPLOAD_BYTES) break;
    }
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob!], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close?.();
  }
}

async function encodeJpeg(bitmap: ImageBitmap, maxDimension: number, quality: number) {
  const { width, height } = computeDownscaleDimensions(bitmap.width, bitmap.height, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  // JPEG has no alpha; transparent PNG/WebP areas would otherwise turn black.
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );
  if (!blob) throw new Error('JPEG encoding failed');
  return blob;
}

async function decode(file: File, kind: ConvertibleKind): Promise<ImageBitmap> {
  // Safari decodes HEIC and TIFF natively, which is much faster than the
  // fallbacks below; other browsers reject and fall through.
  try {
    return await createImageBitmap(file);
  } catch {
    // fall through
  }
  return kind === 'heic' ? decodeHeic(file) : decodeTiff(file);
}

async function decodeHeic(file: File): Promise<ImageBitmap> {
  // Loaded on demand: the libheif build is large. The CSP build avoids eval.
  const { heicTo } = await import('heic-to/csp');
  return heicTo({ blob: file, type: 'bitmap' });
}

async function decodeTiff(file: File): Promise<ImageBitmap> {
  // UTIF is CommonJS (`module.exports = UTIF`); bundlers expose it as default.
  const mod = await import('utif');
  const UTIF = mod.default ?? mod;
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  // Some TIFFs carry a thumbnail alongside the full image; take the largest.
  const area = (ifd: (typeof ifds)[number]) =>
    Number((ifd.t256 as number[] | undefined)?.[0] ?? 0) *
    Number((ifd.t257 as number[] | undefined)?.[0] ?? 0);
  const ifd = ifds.reduce((best, cur) => (area(cur) > area(best) ? cur : best), ifds[0]);
  if (!ifd) throw new Error('No image in TIFF');
  UTIF.decodeImage(buffer, ifd);
  const rgba = UTIF.toRGBA8(ifd);
  const pixels = new Uint8ClampedArray(
    rgba.buffer as ArrayBuffer,
    rgba.byteOffset,
    rgba.byteLength
  );
  return createImageBitmap(new ImageData(pixels, ifd.width, ifd.height));
}
