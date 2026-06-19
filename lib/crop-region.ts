import sharp from 'sharp';
import type { CropData } from '@/db/schema';

export interface ExtractRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Clamp a crop rect (in image pixels) to the image bounds and convert to sharp
 * extract params. Returns null if the rect is degenerate (off-image or zero
 * area) — callers should serve/keep the full image in that case. Pure.
 */
export function cropExtractRegion(
  crop: CropData,
  imgWidth: number,
  imgHeight: number
): ExtractRegion | null {
  const left = Math.max(0, Math.round(crop.x));
  const top = Math.max(0, Math.round(crop.y));
  if (left >= imgWidth || top >= imgHeight) return null;
  const width = Math.min(imgWidth - left, Math.round(crop.width));
  const height = Math.min(imgHeight - top, Math.round(crop.height));
  if (width <= 0 || height <= 0) return null;
  return { left, top, width, height };
}

/** Scale a crop rect by a factor and round (e.g. full-res -> downscaled space). Pure. */
export function scaleRect(crop: CropData, scale: number): CropData {
  return {
    x: Math.round(crop.x * scale),
    y: Math.round(crop.y * scale),
    width: Math.round(crop.width * scale),
    height: Math.round(crop.height * scale),
  };
}

/**
 * Crop an image buffer to the given rect using sharp. If the rect is degenerate
 * relative to the actual image, returns the original buffer unchanged.
 */
export async function extractCrop(buffer: Buffer, crop: CropData): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const region = cropExtractRegion(crop, meta.width ?? 0, meta.height ?? 0);
  if (!region) return buffer;
  return sharp(buffer).extract(region).toBuffer();
}
