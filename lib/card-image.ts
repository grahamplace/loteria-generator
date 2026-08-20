/**
 * Decides how a card thumbnail should be fetched and whether Next's image
 * optimizer can touch it.
 *
 * Three kinds of `src` flow through the card grids and they need different
 * handling:
 *
 * - **Public default-card art** (`/default-cards/la-corona.webp`) — stored as
 *   600×900 webp (~175KB each). Rendered ~180px wide, so `/_next/image` cuts
 *   a 54-card board from ~9MB to well under 1MB. Must be optimized.
 * - **Auth-gated proxy URLs** (`/api/images/...`, `/api/admin/images/...`) —
 *   the Image Optimization API does not forward request headers, so the
 *   optimizer's own fetch arrives without a session cookie and 401s. These
 *   must stay `unoptimized`; the size win comes from asking the proxy itself
 *   for a `?w=` webp thumbnail instead of the full-size source.
 * - **Local base64 previews** (`data:image/...`) — shown optimistically while
 *   an upload is still in flight. The optimizer cannot resolve a data URL.
 */

/** Width requested from the image proxies for grid-sized thumbnails. */
export const CARD_GRID_THUMB_WIDTH = 400;

/** Width requested for the larger side-by-side views on admin detail pages. */
export const CARD_DETAIL_THUMB_WIDTH = 800;

export type CardImageProps = {
  src: string;
  unoptimized: boolean;
};

export function cardImageProps(src: string, proxyWidth: number): CardImageProps {
  if (src.startsWith('data:')) {
    return { src, unoptimized: true };
  }

  if (src.startsWith('/api/')) {
    const separator = src.includes('?') ? '&' : '?';
    return { src: `${src}${separator}w=${proxyWidth}`, unoptimized: true };
  }

  // The optimizer rejects SVG unless `dangerouslyAllowSVG` is on, and vector
  // art gains nothing from resizing anyway.
  if (src.endsWith('.svg')) {
    return { src, unoptimized: true };
  }

  return { src, unoptimized: false };
}
