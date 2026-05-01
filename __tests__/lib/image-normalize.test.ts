import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { normalizeImageForOpenAI } from '@/lib/image-normalize';

async function makeRgbPng({ depth = 8 }: { depth?: 8 | 16 } = {}) {
  return sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png({ palette: false, compressionLevel: 0 })
    .toColorspace(depth === 16 ? 'rgb16' : 'srgb')
    .toBuffer();
}

async function makePalettePng() {
  return sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png({ palette: true, colors: 16 })
    .toBuffer();
}

async function makeGrayscalePng() {
  return sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .toColorspace('b-w')
    .png()
    .toBuffer();
}

describe('normalizeImageForOpenAI', () => {
  it('downcasts 16-bit PNGs to 8-bit sRGB', async () => {
    const input = await makeRgbPng({ depth: 16 });
    const inputMeta = await sharp(input).metadata();
    expect(inputMeta.depth).toBe('ushort');

    const output = await normalizeImageForOpenAI(input);

    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('png');
    expect(meta.depth).toBe('uchar');
    expect(meta.space).toBe('srgb');
  });

  it('expands palette/indexed PNGs to truecolor', async () => {
    const input = await makePalettePng();
    const inputMeta = await sharp(input).metadata();
    expect(inputMeta.isPalette).toBe(true);

    const output = await normalizeImageForOpenAI(input);

    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('png');
    expect(meta.isPalette).toBe(false);
    expect(meta.space).toBe('srgb');
  });

  it('converts grayscale PNGs to sRGB', async () => {
    const input = await makeGrayscalePng();
    const inputMeta = await sharp(input).metadata();
    expect(inputMeta.space).toBe('b-w');

    const output = await normalizeImageForOpenAI(input);

    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('png');
    expect(meta.space).toBe('srgb');
  });

  it('passes through standard 8-bit sRGB PNGs as valid PNG output', async () => {
    const input = await makeRgbPng({ depth: 8 });
    const output = await normalizeImageForOpenAI(input);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('png');
    expect(meta.depth).toBe('uchar');
    expect(meta.space).toBe('srgb');
  });
});
