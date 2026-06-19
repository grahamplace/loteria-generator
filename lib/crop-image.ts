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
