import { describe, it, expect } from 'vitest';
import { parseResizeWidth, derivedImageEtag, MAX_RESIZE_WIDTH } from '@/lib/image-proxy';

describe('parseResizeWidth', () => {
  it('returns null when no width is requested', () => {
    expect(parseResizeWidth(null)).toBeNull();
    expect(parseResizeWidth('')).toBeNull();
  });

  it('parses a plain width', () => {
    expect(parseResizeWidth('400')).toBe(400);
  });

  it('clamps above the maximum so a caller cannot force a huge re-encode', () => {
    expect(parseResizeWidth('99999')).toBe(MAX_RESIZE_WIDTH);
  });

  it('rejects widths below the floor and non-numeric input', () => {
    expect(parseResizeWidth('4')).toBeNull();
    expect(parseResizeWidth('abc')).toBeNull();
  });
});

describe('derivedImageEtag', () => {
  it('is stable for an untouched blob', () => {
    expect(derivedImageEtag('abc', null, null)).toBe('"abc"');
  });

  it('changes when the requested width changes', () => {
    expect(derivedImageEtag('abc', null, 400)).not.toBe(derivedImageEtag('abc', null, 200));
  });

  it('changes when the crop changes', () => {
    const a = derivedImageEtag('abc', { x: 0, y: 0, width: 10, height: 10 }, null);
    const b = derivedImageEtag('abc', { x: 5, y: 0, width: 10, height: 10 }, null);
    expect(a).not.toBe(b);
  });

  it('encodes crop and width together', () => {
    expect(derivedImageEtag('abc', { x: 1, y: 2, width: 3, height: 4 }, 400)).toBe(
      '"abc-crop1-2-3-4-w400-webp"'
    );
  });
});
