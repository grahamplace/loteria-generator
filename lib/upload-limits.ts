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
