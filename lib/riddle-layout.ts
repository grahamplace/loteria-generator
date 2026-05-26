/**
 * Pure layout helpers for rendering a riddle inside a fixed box on a caller
 * card. Kept free of canvas so the wrapping / auto-fit logic can be unit
 * tested with an injected text measurer.
 */

/** Measures the rendered width of a string at the caller's current font. */
export type Measure = (text: string) => number;

/** Measures the rendered width of a string at a given font size (px). */
export type MeasureAtFont = (fontPx: number, text: string) => number;

export interface RiddleFit {
  /** Font size (px) the riddle should render at. */
  fontPx: number;
  /** Word-wrapped lines at that font size. */
  lines: string[];
}

/** Splits an overlong word into chunks that each fit within maxWidth. */
function breakLongWord(word: string, maxWidth: number, measure: Measure): string[] {
  const parts: string[] = [];
  let chunk = '';
  for (const ch of word) {
    const next = chunk + ch;
    if (chunk !== '' && measure(next) > maxWidth) {
      parts.push(chunk);
      chunk = ch;
    } else {
      chunk = next;
    }
  }
  if (chunk !== '') parts.push(chunk);
  return parts;
}

/**
 * Greedily wraps text into lines that fit within maxWidth. Explicit newlines
 * are honored as hard breaks (each paragraph wraps independently; a blank line
 * is preserved); within a paragraph, words wrap on whitespace and a single
 * word wider than maxWidth is hard-broken by character.
 */
export function wrapLines(text: string, maxWidth: number, measure: Measure): string[] {
  if (text.trim() === '') return [];

  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    const flush = () => {
      if (current) {
        lines.push(current);
        current = '';
      }
    };

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }

      flush();

      if (measure(word) > maxWidth) {
        const parts = breakLongWord(word, maxWidth, measure);
        for (let i = 0; i < parts.length - 1; i++) lines.push(parts[i]);
        current = parts[parts.length - 1] ?? '';
      } else {
        current = word;
      }
    }

    flush();
  }

  return lines;
}

export interface FitRiddleOptions {
  text: string;
  maxWidth: number;
  maxHeight: number;
  maxFontPx: number;
  minFontPx: number;
  /** Line advance as a multiple of font size (e.g. 1.18). */
  lineHeightRatio: number;
  measureAtFont: MeasureAtFont;
}

/**
 * Finds the largest font (between min and max) whose word-wrapped block fits
 * within maxWidth × maxHeight. If even the minimum font overflows, returns the
 * minimum font with lines clamped to the available height and an ellipsis on
 * the last visible line.
 */
export function fitRiddle(opts: FitRiddleOptions): RiddleFit {
  const { text, maxWidth, maxHeight, maxFontPx, minFontPx, lineHeightRatio, measureAtFont } = opts;

  for (let fontPx = maxFontPx; fontPx >= minFontPx; fontPx -= 1) {
    const lines = wrapLines(text, maxWidth, (s) => measureAtFont(fontPx, s));
    const blockHeight = lines.length * fontPx * lineHeightRatio;
    if (blockHeight <= maxHeight) {
      return { fontPx, lines };
    }
  }

  // Doesn't fit even at the floor: wrap at min font and clamp to what fits.
  const lines = wrapLines(text, maxWidth, (s) => measureAtFont(minFontPx, s));
  const maxLines = Math.max(1, Math.floor(maxHeight / (minFontPx * lineHeightRatio)));
  if (lines.length <= maxLines) {
    return { fontPx: minFontPx, lines };
  }

  const clamped = lines.slice(0, maxLines);
  const last = clamped[clamped.length - 1].replace(/\s*\S*$/, '').trimEnd();
  clamped[clamped.length - 1] = `${last}…`;
  return { fontPx: minFontPx, lines: clamped };
}
