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

      // canonical points to the page's own locale URL
      const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
      expect(canonicalMatch, `canonical link on ${path}`).toBeTruthy();
      const canonicalHref = canonicalMatch![1];
      expect(canonicalHref).toMatch(
        new RegExp(
          `${canonicalSuffix.replace(/\//g, '\\/')}$|${canonicalSuffix.replace(/\//g, '\\/')}/?$`
        )
      );

      // hreflang trio: en, es-MX, x-default
      expect(html).toMatch(/<link[^>]+rel="alternate"[^>]+hreflang="en"[^>]+href="[^"]+"/);
      expect(html).toMatch(/<link[^>]+rel="alternate"[^>]+hreflang="es-MX"[^>]+href="[^"]+"/);
      expect(html).toMatch(/<link[^>]+rel="alternate"[^>]+hreflang="x-default"[^>]+href="[^"]+"/);
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
});
