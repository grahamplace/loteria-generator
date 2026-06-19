export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageDims {
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
}

/**
 * Convert a crop expressed in the rendered (display) pixel space of an <img>
 * into the image's natural pixel space, rounding and clamping so the rect stays
 * within the image bounds. Pure — unit-tested.
 */
export function scaleCropToNatural(
  crop: { x: number; y: number; width: number; height: number },
  dims: ImageDims
): PixelRect {
  const scaleX = dims.naturalWidth / dims.displayWidth;
  const scaleY = dims.naturalHeight / dims.displayHeight;
  const x = Math.max(0, Math.round(crop.x * scaleX));
  const y = Math.max(0, Math.round(crop.y * scaleY));
  const width = Math.min(dims.naturalWidth - x, Math.round(crop.width * scaleX));
  const height = Math.min(dims.naturalHeight - y, Math.round(crop.height * scaleY));
  return { x, y, width, height };
}

/**
 * Render a natural-pixel crop rect of a File to a JPEG data URL via canvas.
 * Browser-only (uses createImageBitmap + canvas) — verified manually, not unit
 * tested (jsdom has no real canvas).
 */
export async function getCroppedDataUrl(
  file: File,
  rect: PixelRect,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  bitmap.close?.();
  return canvas.toDataURL(mimeType, 0.92);
}
