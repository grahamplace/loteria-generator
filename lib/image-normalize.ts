import sharp from 'sharp';

const OPENAI_EDIT_MAX_DIMENSION = 2048;

/**
 * Normalize an image buffer for OpenAI's images.edit endpoint.
 *
 * OpenAI rejects PNGs that aren't 8-bit sRGB with "Invalid image file or mode".
 * Common offenders: 16-bit/channel PNGs, palette/indexed PNGs, grayscale PNGs,
 * and PNGs with non-sRGB ICC profiles. Re-encode through sharp to a known-good
 * 8-bit sRGB PNG, honoring EXIF orientation along the way.
 *
 * Also caps the longest side at OPENAI_EDIT_MAX_DIMENSION: OpenAI rejects
 * very large inputs (e.g. 11339x11339) with "Invalid input image file", and
 * a flat logo that size can still pass our byte-size upload limit. The output
 * is at most 1536px, so nothing is lost.
 */
export async function normalizeImageForOpenAI(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(OPENAI_EDIT_MAX_DIMENSION, OPENAI_EDIT_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toColorspace('srgb')
    .png({ palette: false, compressionLevel: 6 })
    .toBuffer();
}

/**
 * Re-encode an image OpenAI's vision input can't read (e.g. AVIF) as JPEG.
 * JPEG rather than PNG keeps a full-size photo's payload small.
 */
export async function convertForOpenAIVision(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).rotate().toColorspace('srgb').jpeg({ quality: 90 }).toBuffer();
}
