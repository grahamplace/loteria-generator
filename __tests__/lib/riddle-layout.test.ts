import { describe, it, expect } from 'vitest';
import { wrapLines, fitRiddle } from '@/lib/riddle-layout';

// A simple measurer: width == number of characters (font-size independent).
const charWidth = (s: string) => s.length;

describe('wrapLines', () => {
  it('wraps on word boundaries to fit the max width', () => {
    const lines = wrapLines('aaa bbb ccc', 7, charWidth);
    expect(lines).toEqual(['aaa bbb', 'ccc']);
  });

  it('keeps everything on one line when it fits', () => {
    const lines = wrapLines('short verse', 50, charWidth);
    expect(lines).toEqual(['short verse']);
  });

  it('collapses arbitrary whitespace between words', () => {
    const lines = wrapLines('  aaa   bbb  ', 100, charWidth);
    expect(lines).toEqual(['aaa bbb']);
  });

  it('hard-breaks a single word longer than the max width', () => {
    const lines = wrapLines('aaaaaa', 3, charWidth);
    expect(lines).toEqual(['aaa', 'aaa']);
  });

  it('returns an empty array for empty text', () => {
    expect(wrapLines('', 10, charWidth)).toEqual([]);
  });

  it('honors explicit newlines as hard line breaks', () => {
    const lines = wrapLines('line one\nline two', 100, charWidth);
    expect(lines).toEqual(['line one', 'line two']);
  });

  it('preserves a blank line between paragraphs', () => {
    const lines = wrapLines('a\n\nb', 100, charWidth);
    expect(lines).toEqual(['a', '', 'b']);
  });

  it('word-wraps within each newline-separated paragraph', () => {
    const lines = wrapLines('aaa bbb ccc\nddd', 7, charWidth);
    expect(lines).toEqual(['aaa bbb', 'ccc', 'ddd']);
  });
});

describe('fitRiddle', () => {
  // width grows with both length and font size
  const measureAtFont = (fontPx: number, s: string) => s.length * fontPx * 0.5;

  it('picks the largest font whose wrapped block fits the height', () => {
    const fit = fitRiddle({
      text: 'soy la dama elegante que todos miran pasar',
      maxWidth: 120,
      maxHeight: 200,
      maxFontPx: 34,
      minFontPx: 18,
      lineHeightRatio: 1.2,
      measureAtFont,
    });

    expect(fit.fontPx).toBeLessThanOrEqual(34);
    expect(fit.fontPx).toBeGreaterThanOrEqual(18);
    const blockHeight = fit.lines.length * fit.fontPx * 1.2;
    expect(blockHeight).toBeLessThanOrEqual(200);
    expect(fit.lines.join(' ')).toContain('dama');
  });

  it('prefers a larger font when there is ample room', () => {
    const roomy = fitRiddle({
      text: 'tiny',
      maxWidth: 1000,
      maxHeight: 1000,
      maxFontPx: 34,
      minFontPx: 18,
      lineHeightRatio: 1.2,
      measureAtFont,
    });
    expect(roomy.fontPx).toBe(34);
    expect(roomy.lines).toEqual(['tiny']);
  });

  it('clamps to the floor font and ellipsizes when even the minimum overflows', () => {
    const text = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const fit = fitRiddle({
      text,
      maxWidth: 60,
      maxHeight: 60, // only a couple of lines can fit
      maxFontPx: 34,
      minFontPx: 18,
      lineHeightRatio: 1.2,
      measureAtFont,
    });
    expect(fit.fontPx).toBe(18);
    const maxLines = Math.floor(60 / (18 * 1.2));
    expect(fit.lines.length).toBeLessThanOrEqual(maxLines);
    expect(fit.lines[fit.lines.length - 1].endsWith('…')).toBe(true);
  });
});
