/**
 * Image formats users may upload. A format belongs here only if BOTH:
 * - every current browser can decode it (the raw upload is shown as the
 *   optimistic preview, kept as the card face, and drawn into PDF exports), and
 * - sharp's prebuilt libvips can decode it (crop, normalize, resize on serve).
 *
 * Converted to JPEG in the browser before upload (`lib/convert-upload-image.ts`),
 * so never seen past the picker:
 * - HEIC/HEIF: prebuilt sharp decodes AVIF only, and Chrome/Firefox can't show it.
 * - TIFF: sharp decodes it, but only Safari can display it.
 *
 * Deliberately excluded:
 * - BMP: browsers display it, but prebuilt sharp can't decode it.
 * - SVG: not a photo, and a script-capable upload is an XSS risk.
 */
export const UPLOAD_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

/** Value for an `<input type="file" accept>` attribute. */
export const UPLOAD_IMAGE_ACCEPT = UPLOAD_IMAGE_MIME_TYPES.join(',');

export function isSupportedUploadMime(mime: string): boolean {
  // Some clients report the non-standard `image/jpg`.
  const normalized = mime === 'image/jpg' ? 'image/jpeg' : mime;
  return (UPLOAD_IMAGE_MIME_TYPES as readonly string[]).includes(normalized);
}
