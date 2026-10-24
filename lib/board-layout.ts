/**
 * Pure layout helpers for a 4×4 player board page. Kept free of canvas so the
 * grid maths and title fitting can be unit tested with an injected measurer.
 */
import { PRINT_SAFE_MARGIN_PX } from '@/lib/constants';

/** Height (px at 300 DPI, 0.7") reserved above the grid for a board title. */
export const BOARD_TITLE_BAND_PX = 210;
export const BOARD_TITLE_MAX_FONT_PX = 130;
export const BOARD_TITLE_MIN_FONT_PX = 60;

const ROWS = 4;
const COLS = 4;
const CARD_SPACING = 20;
const CARD_ASPECT_RATIO = 2 / 3;
// The 4×4 grid is height-constrained, so this padding is the printed top and
// bottom margin verbatim — 0.2" before the print-safe margin was added.
const PADDING = 60 + PRINT_SAFE_MARGIN_PX;
// A decorative frame reaches nearly to the legacy grid edge. Reserve another
// 0.3" inside framed pages so cards and titles have space above and below them.
const FRAME_PADDING = 90;

export interface BoardLayout {
  cardWidth: number;
  cardHeight: number;
  cardSpacing: number;
  /** Left edge of the grid. */
  offsetX: number;
  /** Top edge of the grid. */
  offsetY: number;
  gridWidth: number;
  gridHeight: number;
  /** Band above the grid for the board title, or null when untitled. */
  titleBand: { top: number; height: number } | null;
}

/**
 * Sizes and positions the 4×4 card grid on a page. A title band comes off the
 * available height, so cards shrink (keeping 2:3) rather than the margins; the
 * band + grid block is centred vertically with the band on top.
 */
export function computeBoardLayout({
  width,
  height,
  titleBandHeight = 0,
  hasFrame = false,
}: {
  width: number;
  height: number;
  titleBandHeight?: number;
  hasFrame?: boolean;
}): BoardLayout {
  const band = Math.max(0, titleBandHeight);
  const padding = PADDING + (hasFrame ? FRAME_PADDING : 0);
  const availableWidth = width - padding * 2 - CARD_SPACING * (COLS - 1);
  const availableHeight = height - padding * 2 - CARD_SPACING * (ROWS - 1) - band;

  const maxCardWidth = availableWidth / COLS;
  const maxCardHeight = availableHeight / ROWS;

  let cardWidth: number;
  let cardHeight: number;
  if (maxCardWidth / maxCardHeight < CARD_ASPECT_RATIO) {
    cardWidth = maxCardWidth;
    cardHeight = cardWidth / CARD_ASPECT_RATIO;
  } else {
    cardHeight = maxCardHeight;
    cardWidth = cardHeight * CARD_ASPECT_RATIO;
  }

  const gridWidth = cardWidth * COLS + CARD_SPACING * (COLS - 1);
  const gridHeight = cardHeight * ROWS + CARD_SPACING * (ROWS - 1);
  const blockTop = (height - (band + gridHeight)) / 2;

  return {
    cardWidth,
    cardHeight,
    cardSpacing: CARD_SPACING,
    offsetX: (width - gridWidth) / 2,
    offsetY: blockTop + band,
    gridWidth,
    gridHeight,
    titleBand: band > 0 ? { top: blockTop, height: band } : null,
  };
}

/**
 * Fits a board title onto one line: uppercases it, shrinks the font 1px at a
 * time down to minFontPx, then truncates with "…" if it still overflows.
 * Returns null for blank text, meaning "draw no title".
 */
export function fitBoardTitle({
  text,
  maxWidth,
  maxFontPx,
  minFontPx,
  measureAtFont,
}: {
  text: string;
  maxWidth: number;
  maxFontPx: number;
  minFontPx: number;
  measureAtFont: (fontPx: number, text: string) => number;
}): { fontPx: number; text: string } | null {
  const title = text.trim().replace(/\s+/g, ' ').toUpperCase();
  if (title === '') return null;

  for (let fontPx = maxFontPx; fontPx >= minFontPx; fontPx--) {
    if (measureAtFont(fontPx, title) <= maxWidth) return { fontPx, text: title };
  }

  const chars = [...title];
  for (let n = chars.length - 1; n > 0; n--) {
    const candidate = chars.slice(0, n).join('').trimEnd() + '…';
    if (measureAtFont(minFontPx, candidate) <= maxWidth) {
      return { fontPx: minFontPx, text: candidate };
    }
  }
  return { fontPx: minFontPx, text: '…' };
}
