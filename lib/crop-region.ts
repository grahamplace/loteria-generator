import sharp from 'sharp';
import type { CropData } from '@/db/schema';
import { cropExtractRegion } from './crop-math';

// Re-export the pure helpers so server-side callers and tests can keep importing
// from one place. Client components MUST import these from '@/lib/crop-math'
// directly — importing from here would pull `sharp` into the browser bundle.
export type { ExtractRegion } from './crop-math';
export { cropExtractRegion, scaleRect } from './crop-math';

/**
 * Crop an image buffer to the given rect using sharp. If the rect is degenerate
 * relative to the actual image, returns the original buffer unchanged.
 * Server-only (imports sharp).
 */
export async function extractCrop(buffer: Buffer, crop: CropData): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const region = cropExtractRegion(crop, meta.width ?? 0, meta.height ?? 0);
  if (!region) return buffer;
  return sharp(buffer).extract(region).toBuffer();
}
