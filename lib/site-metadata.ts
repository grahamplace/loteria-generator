import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

/** Single source of truth for the site's absolute origin. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://loteria-generator-eta.vercel.app';

// The social share assets. Both are 1200x630 PNGs under /public, and both carry
// baked-in copy, so each locale gets its own file rather than one shared image.
// Replacing a card means overwriting the file at these paths — nothing else
// names them. They stay relative on purpose: `metadataBase` (set in the root
// layout and the locale layout) resolves them into fully qualified URLs.
export const OG_IMAGE_PATHS = {
  en: '/og-image.png',
  'es-MX': '/og-image-es.png',
} as const satisfies Record<(typeof routing.locales)[number], string>;

/** The default (English) card, for the routes that render outside `[locale]`. */
export const OG_IMAGE_PATH = OG_IMAGE_PATHS.en;
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Brand color for `<meta name="theme-color">`. Matches `app/manifest.ts`. */
export const THEME_COLOR = '#c8362e';

/**
 * The share card for a locale. Takes the raw locale string that `params` hands
 * a page (not a narrowed `Locale`), and falls back to English for anything
 * unrecognized so an unexpected segment can never yield a 404 image URL.
 */
export function ogImagePath(locale: string): string {
  return locale in OG_IMAGE_PATHS
    ? OG_IMAGE_PATHS[locale as keyof typeof OG_IMAGE_PATHS]
    : OG_IMAGE_PATH;
}

// `openGraph.images` accepts a single entry or an array, and each entry can be a
// bare string, a URL, or a descriptor object. Narrow to the array-of-descriptors
// form so callers get a real, indexable list whose fields are readable.
type OpenGraphImages = NonNullable<NonNullable<Metadata['openGraph']>['images']>;
type OpenGraphImage = Extract<OpenGraphImages, readonly unknown[]>[number];
type SocialImage = Extract<OpenGraphImage, { url: unknown }>;

/**
 * The shared `openGraph.images` / `twitter.images` entry. Both fields take the
 * same descriptor shape, so one helper covers each page's social card. Omit
 * `locale` for the routes that have no i18n context.
 */
export function ogImages(alt: string, locale?: string): SocialImage[] {
  return [
    {
      url: locale ? ogImagePath(locale) : OG_IMAGE_PATH,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      alt,
      type: 'image/png',
    },
  ];
}
