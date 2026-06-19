export interface Dimensions {
  width: number;
  height: number;
}

/** Scale the longest side down to `max`, preserving aspect ratio. Never upscales. Pure. */
export function computeDownscaleDimensions(width: number, height: number, max: number): Dimensions {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.floor(width * scale), height: Math.floor(height * scale) };
}

/**
 * Downscale an image File to a max longest-side dimension via canvas, returning
 * a data URL plus the applied scale factor (1 if no downscale). Browser-only.
 */
export async function downscaleToDataUrl(
  file: File,
  max: number
): Promise<{ dataUrl: string; scale: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = computeDownscaleDimensions(bitmap.width, bitmap.height, max);
  const scale = bitmap.width === 0 ? 1 : width / bitmap.width;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { dataUrl: canvas.toDataURL(mime, 0.92), scale };
}
