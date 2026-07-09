import { describe, it, expect } from 'vitest';
import { adminCardImageSrc } from '@/lib/admin-card-image';

function makeCard(overrides: Partial<Parameters<typeof adminCardImageSrc>[0]> = {}) {
  return {
    id: 'card-1',
    isDefault: false,
    illustrationUrl: null,
    originalImageUrl: null,
    ...overrides,
  };
}

describe('adminCardImageSrc', () => {
  it('serves default ("classic") cards directly from their public illustrationUrl', () => {
    const card = makeCard({
      id: 'abc',
      isDefault: true,
      illustrationUrl: '/default-cards/la-corona.webp',
    });
    // Must NOT route through the private-blob proxy — that server-side
    // fetch()es the relative path and 404s.
    expect(adminCardImageSrc(card)).toBe('/default-cards/la-corona.webp');
  });

  it('routes user illustrations through the authenticated admin proxy', () => {
    const card = makeCard({
      id: 'xyz',
      isDefault: false,
      illustrationUrl: 'https://foo.private.blob.vercel-storage.com/xyz.png',
    });
    expect(adminCardImageSrc(card)).toBe('/api/admin/images/xyz/illustration');
  });

  it('falls back to the original image proxy when there is no illustration', () => {
    const card = makeCard({
      id: 'xyz',
      isDefault: false,
      illustrationUrl: null,
      originalImageUrl: 'https://foo.private.blob.vercel-storage.com/xyz.jpg',
    });
    expect(adminCardImageSrc(card)).toBe('/api/admin/images/xyz/original');
  });

  it('returns null when the card has no image at all', () => {
    expect(adminCardImageSrc(makeCard())).toBeNull();
  });
});
