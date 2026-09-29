import { describe, it, expect } from 'vitest';
import {
  computeBoardLayout,
  fitBoardTitle,
  BOARD_TITLE_BAND_PX,
  BOARD_TITLE_MAX_FONT_PX,
  BOARD_TITLE_MIN_FONT_PX,
} from '@/lib/board-layout';
import { PRINT_SAFE_MARGIN_PX } from '@/lib/constants';

const W = 2550;
const H = 3300;
const PADDING = 60 + PRINT_SAFE_MARGIN_PX;

// Fake measurer: every character is 0.6em wide.
const measureAtFont = (fontPx: number, text: string) => [...text].length * fontPx * 0.6;

describe('computeBoardLayout', () => {
  it('reproduces the untitled layout exactly', () => {
    const layout = computeBoardLayout({ width: W, height: H });
    expect(layout.cardWidth).toBeCloseTo(507.5, 5);
    expect(layout.cardHeight).toBeCloseTo(761.25, 5);
    expect(layout.cardSpacing).toBe(20);
    expect(layout.offsetY).toBeCloseTo(PADDING, 5);
    expect(layout.offsetX).toBeCloseTo((W - layout.gridWidth) / 2, 5);
    expect(layout.titleBand).toBeNull();
  });

  it('treats a zero band as no title', () => {
    expect(computeBoardLayout({ width: W, height: H, titleBandHeight: 0 }).titleBand).toBeNull();
  });

  it('reserves a title band above a smaller grid inside the same margins', () => {
    const plain = computeBoardLayout({ width: W, height: H });
    const titled = computeBoardLayout({
      width: W,
      height: H,
      titleBandHeight: BOARD_TITLE_BAND_PX,
    });

    expect(titled.titleBand).not.toBeNull();
    expect(titled.titleBand!.top).toBeCloseTo(PADDING, 5);
    expect(titled.titleBand!.height).toBe(BOARD_TITLE_BAND_PX);
    expect(titled.offsetY).toBeCloseTo(PADDING + BOARD_TITLE_BAND_PX, 5);
    expect(titled.offsetY + titled.gridHeight).toBeLessThanOrEqual(H - PADDING + 1e-6);
    expect(titled.cardHeight).toBeLessThan(plain.cardHeight);
    expect(titled.cardWidth / titled.cardHeight).toBeCloseTo(2 / 3, 5);
    expect(titled.offsetX).toBeCloseTo((W - titled.gridWidth) / 2, 5);
  });
});

describe('fitBoardTitle', () => {
  const base = {
    maxWidth: 2000,
    maxFontPx: BOARD_TITLE_MAX_FONT_PX,
    minFontPx: BOARD_TITLE_MIN_FONT_PX,
    measureAtFont,
  };

  it('returns null for blank text', () => {
    expect(fitBoardTitle({ ...base, text: '' })).toBeNull();
    expect(fitBoardTitle({ ...base, text: '   \n ' })).toBeNull();
  });

  it('trims, uppercases, and caps a short title at the max font size', () => {
    expect(fitBoardTitle({ ...base, text: '  Boda  ' })).toEqual({
      fontPx: BOARD_TITLE_MAX_FONT_PX,
      text: 'BODA',
    });
  });

  it('keeps accented characters when uppercasing', () => {
    expect(fitBoardTitle({ ...base, text: 'fiesta de Ñoño' })!.text).toBe('FIESTA DE ÑOÑO');
  });

  it('shrinks the font until the title fits', () => {
    // 30 chars: fits at 111px (30*111*0.6 = 1998) but not at 112px.
    const fit = fitBoardTitle({ ...base, text: 'a'.repeat(30) })!;
    expect(fit.fontPx).toBe(111);
    expect(fit.text).toBe('A'.repeat(30));
    expect(measureAtFont(fit.fontPx, fit.text)).toBeLessThanOrEqual(base.maxWidth);
  });

  it('ellipsizes at the min font size when shrinking is not enough', () => {
    const fit = fitBoardTitle({ ...base, text: 'x'.repeat(120) })!;
    expect(fit.fontPx).toBe(BOARD_TITLE_MIN_FONT_PX);
    expect(fit.text.endsWith('…')).toBe(true);
    expect(measureAtFont(fit.fontPx, fit.text)).toBeLessThanOrEqual(base.maxWidth);
    // 2000 / (60*0.6) = 55.5 → 54 x's + "…"
    expect(fit.text).toBe('X'.repeat(54) + '…');
  });

  it('does not leave a trailing space before the ellipsis', () => {
    const text = 'word '.repeat(40);
    const fit = fitBoardTitle({ ...base, text })!;
    expect(fit.text).not.toMatch(/\s…$/);
  });
});
