import { describe, it, expect } from 'vitest';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  SITE_URL,
  OG_IMAGE_PATH,
  OG_IMAGE_PATHS,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  THEME_COLOR,
  ogImagePath,
  ogImages,
} from '@/lib/site-metadata';
import { routing } from '@/i18n/routing';

describe('site metadata constants', () => {
  it('exposes an absolute site URL', () => {
    expect(() => new URL(SITE_URL)).not.toThrow();
    expect(SITE_URL).not.toMatch(/\/$/);
  });

  it('has a distinct share card for every routed locale', () => {
    expect(Object.keys(OG_IMAGE_PATHS).sort()).toEqual([...routing.locales].sort());
    const paths = Object.values(OG_IMAGE_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('points at root-relative paths so metadataBase can absolutise them', () => {
    for (const path of Object.values(OG_IMAGE_PATHS)) {
      expect(path.startsWith('/')).toBe(true);
      expect(path.startsWith('//')).toBe(false);
    }
  });

  it('defaults to the English card for routes with no i18n context', () => {
    expect(OG_IMAGE_PATH).toBe(OG_IMAGE_PATHS.en);
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

describe('ogImagePath', () => {
  it('resolves each routed locale to its own card', () => {
    expect(ogImagePath('en')).toBe(OG_IMAGE_PATHS.en);
    expect(ogImagePath('es-MX')).toBe(OG_IMAGE_PATHS['es-MX']);
  });

  // A bad segment must never produce a URL that 404s in someone's unfurl.
  it('falls back to the default card for an unrecognized locale', () => {
    expect(ogImagePath('fr')).toBe(OG_IMAGE_PATH);
    expect(ogImagePath('')).toBe(OG_IMAGE_PATH);
    expect(ogImagePath('es')).toBe(OG_IMAGE_PATH); // URL prefix, not the locale token
  });
});

describe('ogImages', () => {
  it('returns a single fully described image entry', () => {
    const images = ogImages('Alt text');
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      url: OG_IMAGE_PATH,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      alt: 'Alt text',
      type: 'image/png',
    });
  });

  it('carries the caller-supplied alt text through verbatim', () => {
    expect(ogImages('Lotería personalizada')[0].alt).toBe('Lotería personalizada');
  });

  it('selects the localized card when given a locale', () => {
    expect(ogImages('alt', 'es-MX')[0].url).toBe(OG_IMAGE_PATHS['es-MX']);
    expect(ogImages('alt', 'en')[0].url).toBe(OG_IMAGE_PATHS.en);
  });

  it('uses the default card when no locale is given', () => {
    expect(ogImages('alt')[0].url).toBe(OG_IMAGE_PATH);
  });
});

// Guards the swap: whoever replaces a card with a new asset has to keep the
// dimensions the metadata advertises, or crawlers render a mismatched unfurl.
describe.each(Object.entries(OG_IMAGE_PATHS))('public%s', (_locale, imagePath) => {
  const file = join(process.cwd(), 'public', imagePath.replace(/^\//, ''));

  it('exists', () => {
    expect(statSync(file).isFile()).toBe(true);
  });

  it('is a PNG matching the advertised dimensions', async () => {
    const meta = await sharp(file).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(OG_IMAGE_WIDTH);
    expect(meta.height).toBe(OG_IMAGE_HEIGHT);
  });

  // X caps at 5MB, Facebook at 8MB — the tighter limit is the one that binds.
  it('stays under the 5MB limit X enforces', () => {
    expect(statSync(file).size).toBeLessThan(5 * 1024 * 1024);
  });
});
