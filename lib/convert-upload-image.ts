import { computeDownscaleDimensions } from '@/lib/downscale-image';

/**
 * Browser-side conversion for photo formats the rest of the pipeline can't
 * read (see `lib/image-formats.ts`): HEIC/HEIF (iPhone photos) and TIFF. They
 * are re-encoded as JPEG at selection time, so previews, uploads, the server
 * and PDF exports only ever see a format every browser and sharp can decode.
 */

export type ConvertibleKind = 'heic' | 'tiff';

const HEIC_MIME = /^image\/hei[cf](-sequence)?$/i;
const HEIC_EXT = /\.hei[cf]$/i;
const TIFF_MIME = /^image\/tiff?$/i;
const TIFF_EXT = /\.tiff?$/i;

/** Extra `accept` entries for convertible formats. Extensions are listed too:
 * Chrome and Firefox often report an empty MIME type for HEIC. */
export const CONVERTIBLE_IMAGE_ACCEPT = 'image/heic,image/heif,.heic,.heif,image/tiff,.tif,.tiff';

/** Longest side of a converted photo. Keeps a 12MP photo's JPEG well under the
 * upload cap while staying far above print resolution for a card. */
const MAX_CONVERTED_DIMENSION = 3000;
const JPEG_QUALITY = 0.88;

export function convertibleKind(file: Pick<File, 'name' | 'type'>): ConvertibleKind | null {
  if (HEIC_MIME.test(file.type) || HEIC_EXT.test(file.name)) return 'heic';
  if (TIFF_MIME.test(file.type) || TIFF_EXT.test(file.name)) return 'tiff';
  return null;
}

/** True for anything the upload flow can take, before or after conversion. */
export function isUploadCandidate(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type.startsWith('image/') || convertibleKind(file) !== null;
}

/**
 * Returns `file` unchanged if it needs no conversion, otherwise a JPEG `File`
 * with the same base name (filename-derived labels stay the same). Throws if
 * the file can't be decoded.
 */
export async function convertForUpload(file: File): Promise<File> {
  const kind = convertibleKind(file);
  if (!kind) return file;

  const bitmap = await decode(file, kind);
  try {
    const { width, height } = computeDownscaleDimensions(
      bitmap.width,
      bitmap.height,
      MAX_CONVERTED_DIMENSION
    );
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob) throw new Error('JPEG encoding failed');
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close?.();
  }
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
