/**
 * Derive a card label from an uploaded file's name by stripping the last
 * extension and trimming whitespace. Used by the admin bulk-upload tool when
 * "use filename as label" is enabled. Returns '' when nothing usable remains.
 */
export function filenameToLabel(filename: string): string {
  // Trim whitespace first
  const trimmed = filename.trim();

  // If nothing remains after trimming, return empty
  if (!trimmed) {
    return '';
  }

  // Find the last dot to identify the extension
  const lastDot = trimmed.lastIndexOf('.');

  // If there's a dot and content before it (lastDot > 0), strip the extension
  // If lastDot === 0, the filename starts with a dot (like ".png"), so there's no name
  if (lastDot > 0) {
    return trimmed.slice(0, lastDot).trim();
  }

  // If no dot or dot at start, return the trimmed name (or empty if it's just ".something")
  return lastDot === 0 ? '' : trimmed;
}
