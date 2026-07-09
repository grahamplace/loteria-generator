import type { Card } from '@/db/schema';

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
  card: Pick<Card, 'id' | 'isDefault' | 'illustrationUrl' | 'originalImageUrl'>
): string | null {
  if (card.isDefault && card.illustrationUrl) {
    return card.illustrationUrl;
  }
  if (card.illustrationUrl) {
    return `/api/admin/images/${card.id}/illustration`;
  }
  if (card.originalImageUrl) {
    return `/api/admin/images/${card.id}/original`;
  }
  return null;
}
