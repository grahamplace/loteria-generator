/**
 * Upload size limit for card photos.
 *
 * Photos are sent to the API as base64 inside a JSON body, and base64 inflates
 * the payload by ~33%. Vercel rejects any request body over 4.5MB at the
 * platform level (before our handler runs), so the raw-image ceiling is lower
 * than it looks: 3MB raw → ~4.1MB body, safely under the limit.
 *
 * MUST keep these two values in sync: MAX_UPLOAD_BYTES is enforced in code,
 * MAX_UPLOAD_DISPLAY is shown in UI copy / error messages.
 */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3MB
export const MAX_UPLOAD_DISPLAY = '3MB';

export interface PartitionedFiles<T> {
  /** Files within the size limit, in their original order. */
  valid: T[];
  /** Files that exceed the size limit. */
  oversized: T[];
}

/**
 * Splits files into those within the size limit and those that exceed it.
 * Accepts anything with a numeric `size` (e.g. a `File`) so it can be unit
 * tested without constructing real blobs.
 */
export function partitionBySize<T extends { size: number }>(
  files: T[],
  maxBytes: number = MAX_UPLOAD_BYTES
): PartitionedFiles<T> {
  const valid: T[] = [];
  const oversized: T[] = [];
  for (const file of files) {
    if (file.size > maxBytes) {
      oversized.push(file);
    } else {
      valid.push(file);
    }
  }
  return { valid, oversized };
}

/**
 * Vercel's platform cap on a request body. A request over it gets a bare 413
 * before our handler runs, so the response carries no JSON error to show.
 * Decimal megabytes: the stricter reading of Vercel's "4.5MB".
 */
export const MAX_REQUEST_BODY_BYTES = 4_500_000;
export const MAX_REQUEST_BODY_DISPLAY = '4.5MB';

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}

/** Error message for a request body over the platform cap, or null if it fits. */
export function requestBodyLimitError(bytes: number): string | null {
  if (bytes <= MAX_REQUEST_BODY_BYTES) return null;
  return `Too large to upload: ${formatMegabytes(bytes)}, over the ${MAX_REQUEST_BODY_DISPLAY} limit. Resize the photo and try again.`;
}

/**
 * Turns a failed upload response into a message worth showing: the platform's
 * bare 413, a Zod field error on the image, or the API's own message/error.
 */
export function describeUploadFailure(status: number, body: unknown): string {
  if (status === 413) {
    return `Too large to upload: over the ${MAX_REQUEST_BODY_DISPLAY} limit. Resize the photo and try again.`;
  }
  if (body && typeof body === 'object') {
    const { message, error, details } = body as {
      message?: unknown;
      error?: unknown;
      details?: { fieldErrors?: { originalImageBase64?: unknown } };
    };
    const imageErrors = details?.fieldErrors?.originalImageBase64;
    if (Array.isArray(imageErrors) && typeof imageErrors[0] === 'string') return imageErrors[0];
    if (typeof message === 'string') return message;
    if (typeof error === 'string') return error;
  }
  return `Upload failed (HTTP ${status})`;
}
