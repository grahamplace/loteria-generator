import type { Card } from '@/db/schema';

/**
 * Authenticated admin proxy URL for one of a card's images, versioned by
 * updatedAt. The proxy URL is keyed by card id, not by blob, and the proxy
 * lets browsers cache for an hour — so without the version a regenerated,
 * replaced or photo-switched image keeps showing the stale copy.
 * updatedAt may arrive as a string once a card has been JSON-serialized.
 */
export function adminCardProxySrc(
  cardId: string,
  type: 'original' | 'illustration',
  updatedAt: Date | string
): string {
  return `/api/admin/images/${cardId}/${type}?v=${new Date(updatedAt).getTime()}`;
}

/**
 * Resolve the <img> src for a card in the admin board grid.
 *
 * Default ("classic") cards store a public, relative illustrationUrl
 * (e.g. `/default-cards/la-corona.webp`) served straight from `public/`.
 * Serve those directly — routing them through the private-blob proxy at
 * `/api/admin/images/...` fails because the proxy does a server-side
 * `fetch()` of the relative path, which throws and 404s. This mirrors the
 * consumer board page, which also renders default cards from illustrationUrl.
 *
 * User-uploaded cards store private blob URLs and must go through the
 * authenticated proxy.
 *
 * Returns null when the card has no image to show.
 */
export function adminCardImageSrc(
  card: Pick<Card, 'id' | 'isDefault' | 'illustrationUrl' | 'originalImageUrl' | 'updatedAt'>
): string | null {
  if (card.isDefault && card.illustrationUrl) {
    return card.illustrationUrl;
  }
  if (card.illustrationUrl) {
    return adminCardProxySrc(card.id, 'illustration', card.updatedAt);
  }
  if (card.originalImageUrl) {
    return adminCardProxySrc(card.id, 'original', card.updatedAt);
  }
  return null;
}
