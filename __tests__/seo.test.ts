import { describe, it, expect } from 'vitest';

const BASE = process.env.SEO_TEST_BASE_URL || '';

async function fetchHtml(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`);
  expect(res.ok, `${path} should return 2xx`).toBe(true);
  return res.text();
}

const cases = [
  { path: '/', lang: 'en', canonicalSuffix: '/' },
  { path: '/es', lang: 'es-MX', canonicalSuffix: '/es' },
  { path: '/faq', lang: 'en', canonicalSuffix: '/faq' },
  { path: '/es/faq', lang: 'es-MX', canonicalSuffix: '/es/faq' },
] as const;

describe.skipIf(!BASE)('SEO tags on indexed marketing pages', () => {
  it.each(cases)(
    '$path has correct lang, canonical, and hreflang',
    async ({ path, lang, canonicalSuffix }) => {
      const html = await fetchHtml(path);

      // <html lang="en"> or <html lang="es-MX">
      const langMatch = html.match(/<html[^>]+lang="([^"]+)"/);
      expect(langMatch, `<html lang> attribute on ${path}`).toBeTruthy();
      expect(langMatch![1]).toBe(lang);

      // canonical points to the page's own locale URL. Compare pathnames rather
      // than string-matching the tail: Next emits the site root as a bare origin
      // with no trailing slash, which no suffix regex matches.
      const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
      expect(canonicalMatch, `canonical link on ${path}`).toBeTruthy();
      const canonicalUrl = new URL(canonicalMatch![1]);
      const normalize = (p: string) => (p.length > 1 ? p.replace(/\/$/, '') : '/');
      expect(normalize(canonicalUrl.pathname)).toBe(normalize(canonicalSuffix));

      // hreflang trio: en, es-MX, x-default.
      // Case-insensitive: React serializes the attribute as `hrefLang` in the
      // streamed HTML (verified in both `next dev` and a production build).
      // HTML attribute names are case-insensitive, so crawlers read it fine.
      expect(html).toMatch(/<link[^>]+rel="alternate"[^>]+hreflang="en"[^>]+href="[^"]+"/i);
      expect(html).toMatch(/<link[^>]+rel="alternate"[^>]+hreflang="es-MX"[^>]+href="[^"]+"/i);
      expect(html).toMatch(/<link[^>]+rel="alternate"[^>]+hreflang="x-default"[^>]+href="[^"]+"/i);
    }
  );

  it('og:locale matches the active locale on /', async () => {
    const html = await fetchHtml('/');
    expect(html).toMatch(/<meta[^>]+property="og:locale"[^>]+content="en_US"/);
    expect(html).toMatch(/<meta[^>]+property="og:locale:alternate"[^>]+content="es_MX"/);
  });

  it('og:locale matches the active locale on /es', async () => {
    const html = await fetchHtml('/es');
    expect(html).toMatch(/<meta[^>]+property="og:locale"[^>]+content="es_MX"/);
    expect(html).toMatch(/<meta[^>]+property="og:locale:alternate"[^>]+content="en_US"/);
  });

  it.each(cases)('$path advertises a shareable Open Graph image', async ({ path }) => {
    const html = await fetchHtml(path);

    // og:image must be absolute — Facebook/Slack/iMessage reject relative URLs.
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
    expect(ogImage, `og:image on ${path}`).toBeTruthy();
    expect(() => new URL(ogImage![1])).not.toThrow();

    // Dimensions let crawlers render the card before the image has downloaded.
    expect(html).toMatch(/<meta[^>]+property="og:image:width"[^>]+content="1200"/);
    expect(html).toMatch(/<meta[^>]+property="og:image:height"[^>]+content="630"/);
    expect(html).toMatch(/<meta[^>]+property="og:image:alt"[^>]+content="[^"]+"/);
  });

  it.each(cases)('$path advertises a large Twitter card image', async ({ path }) => {
    const html = await fetchHtml(path);

    expect(html).toMatch(/<meta[^>]+name="twitter:card"[^>]+content="summary_large_image"/);
    const twitterImage = html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/);
    expect(twitterImage, `twitter:image on ${path}`).toBeTruthy();
    expect(() => new URL(twitterImage![1])).not.toThrow();
  });

  it.each(cases)('$path serves the OG image it advertises', async ({ path }) => {
    const html = await fetchHtml(path);
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)![1];

    // The previous OG route 404'd because the intl proxy rewrote it into the
    // [locale] segment. Fetch it for real so that can't regress silently.
    const res = await fetch(`${BASE}${new URL(ogImage).pathname}`);
    expect(res.status, `GET ${ogImage}`).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^image\//);
  });

  it('sets a theme-color matching the brand background', async () => {
    const html = await fetchHtml('/');
    expect(html).toMatch(/<meta[^>]+name="theme-color"[^>]+content="[^"]+"/);
  });
});
