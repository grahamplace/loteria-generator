/**
 * Shared helpers for the two auth-gated image proxies
 * (`/api/images/**` and `/api/admin/images/**`).
 *
 * Both serve private Vercel Blob objects that `/_next/image` cannot optimize —
 * the Image Optimization API does not forward request headers, so its fetch
 * arrives without a session cookie. Resizing therefore happens here instead.
 */

/**
 * Upper bound on the on-the-fly resize width. Stored illustrations are
 * 1024×1536 PNGs (~2-4MB); grids render them a few hundred pixels wide, so a
 * `?w=` thumbnail request collapses that to a few KB of webp.
 */
export const MAX_RESIZE_WIDTH = 1536;

export function parseResizeWidth(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 16) return null;
  return Math.min(n, MAX_RESIZE_WIDTH);
}

export async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Cache-Control for derived (cropped and/or resized) responses.
 *
 * These are private per-user images so they must never reach a shared cache,
 * but the previous `no-cache` forced a full revalidation — and therefore a
 * blob read plus a sharp re-encode — on every board revisit. The source blob
 * is immutable once written (a replaced illustration gets a new blob URL), so
 * the browser can hold it for an hour before asking again.
 */
export const DERIVED_IMAGE_CACHE_CONTROL = 'private, max-age=3600, must-revalidate';

/**
 * Builds the ETag for a derived image so that a crop or a width change busts
 * the browser's copy even though the underlying blob etag is unchanged.
 */
export function derivedImageEtag(
  blobEtag: string,
  cropRect: { x: number; y: number; width: number; height: number } | null,
  resizeWidth: number | null
): string {
  const cropSig = cropRect
    ? `-crop${cropRect.x}-${cropRect.y}-${cropRect.width}-${cropRect.height}`
    : '';
  const widthSig = resizeWidth ? `-w${resizeWidth}-webp` : '';
  return `"${blobEtag}${cropSig}${widthSig}"`;
}
