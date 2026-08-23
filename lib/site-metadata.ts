import type { Metadata } from 'next';

/** Single source of truth for the site's absolute origin. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://loteria-generator-eta.vercel.app';

// The one place that names the social share asset — point this at a different
// file (or a per-locale asset) and every og:image / twitter:image follows.
// It stays a relative path on purpose: `metadataBase` (set in the root layout
// and the locale layout) resolves it into a fully qualified URL for the tags.
export const OG_IMAGE_PATH = '/og-image.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Brand color for `<meta name="theme-color">`. Matches `app/manifest.ts`. */
export const THEME_COLOR = '#c8362e';

// `openGraph.images` accepts a single entry or an array; narrow it to the array
// element so callers get a real, indexable list back.
type OpenGraphImages = NonNullable<NonNullable<Metadata['openGraph']>['images']>;
type OpenGraphImage = Extract<OpenGraphImages, readonly unknown[]>[number];

/**
 * The shared `openGraph.images` / `twitter.images` entry. Both fields take the
 * same descriptor shape, so one helper covers each page's social card.
 */
export function ogImages(alt: string): OpenGraphImage[] {
  return [
    {
      url: OG_IMAGE_PATH,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      alt,
      type: 'image/png',
    },
  ];
}
