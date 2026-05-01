import sharp from 'sharp';

/**
 * Normalize an image buffer for OpenAI's images.edit endpoint.
 *
 * OpenAI rejects PNGs that aren't 8-bit sRGB with "Invalid image file or mode".
 * Common offenders: 16-bit/channel PNGs, palette/indexed PNGs, grayscale PNGs,
 * and PNGs with non-sRGB ICC profiles. Re-encode through sharp to a known-good
 * 8-bit sRGB PNG, honoring EXIF orientation along the way.
 */
export async function normalizeImageForOpenAI(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .toColorspace('srgb')
    .png({ palette: false, compressionLevel: 6 })
    .toBuffer();
}
