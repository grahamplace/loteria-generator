import { describe, it, expect } from 'vitest';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  SITE_URL,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  THEME_COLOR,
  ogImages,
} from '@/lib/site-metadata';

describe('site metadata constants', () => {
  it('exposes an absolute site URL', () => {
    expect(() => new URL(SITE_URL)).not.toThrow();
    expect(SITE_URL).not.toMatch(/\/$/);
  });

  it('points at a root-relative OG image path so metadataBase can absolutise it', () => {
    expect(OG_IMAGE_PATH.startsWith('/')).toBe(true);
    expect(OG_IMAGE_PATH.startsWith('//')).toBe(false);
  });

  it('uses the 1.91:1 dimensions Open Graph and Twitter summary_large_image expect', () => {
    expect(OG_IMAGE_WIDTH).toBe(1200);
    expect(OG_IMAGE_HEIGHT).toBe(630);
  });

  it('uses a theme color that matches the web app manifest', async () => {
    const manifest = (await import('@/app/manifest')).default();
    expect(THEME_COLOR).toBe(manifest.theme_color);
  });
});

// `Metadata['openGraph']['images']` is a wide union (string | object | array of
// either), so narrow it once here rather than casting at every assertion.
function firstImage(alt: string) {
  const images = ogImages(alt);
  expect(Array.isArray(images)).toBe(true);
  const [first] = images as Array<{ url: string; width: number; height: number; alt: string }>;
  return first;
}

describe('ogImages', () => {
  it('returns a single fully described image entry', () => {
    expect(ogImages('Alt text')).toHaveLength(1);
    expect(firstImage('Alt text')).toMatchObject({
      url: OG_IMAGE_PATH,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      alt: 'Alt text',
      type: 'image/png',
    });
  });

  it('carries the caller-supplied alt text through verbatim', () => {
    expect(firstImage('Lotería personalizada').alt).toBe('Lotería personalizada');
  });
});

// Guards the swap: whoever replaces the placeholder with a real asset has to keep
// the dimensions the metadata advertises, or crawlers get a mismatched card.
describe('public/og-image.png', () => {
  const file = join(process.cwd(), 'public', OG_IMAGE_PATH.replace(/^\//, ''));

  it('exists', () => {
    expect(statSync(file).isFile()).toBe(true);
  });

  it('is a PNG matching the advertised dimensions and under the 8MB OG limit', async () => {
    const meta = await sharp(file).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(OG_IMAGE_WIDTH);
    expect(meta.height).toBe(OG_IMAGE_HEIGHT);
    expect(statSync(file).size).toBeLessThan(8 * 1024 * 1024);
  });
});
