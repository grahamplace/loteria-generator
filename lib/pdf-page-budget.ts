/**
 * JPEG quality (0–1) for each rendered PDF page when there is no size budget.
 *
 * Each page is a 2550×3300 (300 DPI) canvas, so the per-page JPEG dominates the
 * exported file size. 0.80 is visually indistinguishable from higher settings
 * at 300 DPI.
 */
export const PDF_PAGE_JPEG_QUALITY = 0.8;

/** The lowest quality a size budget may push a page to. Below this, prints soften visibly. */
export const MIN_BUDGETED_JPEG_QUALITY = 0.5;

const QUALITY_STEP = 0.04;

const roundQuality = (q: number) => Math.round(q * 100) / 100;

/** Decoded byte size of a base64 data URL's payload. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

/**
 * Encodes PDF pages one at a time, keeping their total under `maxBytes`.
 *
 * Each page may use the bytes still left divided by the pages still to come, so
 * a light page hands its savings to the pages after it. A page over its share
 * is re-encoded a step lower, never below MIN_BUDGETED_JPEG_QUALITY. Each page
 * starts one step above the last page's quality, so similar pages take one or
 * two encodes instead of walking down from the top every time.
 *
 * Without `maxBytes`, every page is encoded once at PDF_PAGE_JPEG_QUALITY.
 */
export function createJpegPageEncoder({
  maxBytes,
  pageCount,
}: {
  maxBytes?: number;
  pageCount: number;
}) {
  let remainingBytes = maxBytes ?? Infinity;
  let remainingPages = pageCount;
  let lastQuality = PDF_PAGE_JPEG_QUALITY;

  return (encode: (quality: number) => string): string => {
    if (maxBytes === undefined) return encode(PDF_PAGE_JPEG_QUALITY);

    const share = remainingBytes / Math.max(1, remainingPages);
    let quality = roundQuality(Math.min(PDF_PAGE_JPEG_QUALITY, lastQuality + QUALITY_STEP));
    let dataUrl = encode(quality);
    while (dataUrlBytes(dataUrl) > share && quality > MIN_BUDGETED_JPEG_QUALITY) {
      quality = roundQuality(Math.max(MIN_BUDGETED_JPEG_QUALITY, quality - QUALITY_STEP));
      dataUrl = encode(quality);
    }

    remainingBytes -= dataUrlBytes(dataUrl);
    remainingPages -= 1;
    lastQuality = quality;
    return dataUrl;
  };
}
