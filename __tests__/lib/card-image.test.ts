import { describe, it, expect } from 'vitest';
import { cardImageProps, CARD_GRID_THUMB_WIDTH } from '@/lib/card-image';

describe('cardImageProps', () => {
  it('optimizes public default-card art', () => {
    // The whole point: 600×900 webp source rendered ~180px wide.
    expect(cardImageProps('/default-cards/la-corona.webp', CARD_GRID_THUMB_WIDTH)).toEqual({
      src: '/default-cards/la-corona.webp',
      unoptimized: false,
    });
  });

  it('asks the consumer proxy for a thumbnail and leaves it unoptimized', () => {
    // /_next/image cannot forward the session cookie, so the optimizer would 401.
    expect(cardImageProps('/api/images/board-1/card-1/illustration', 400)).toEqual({
      src: '/api/images/board-1/card-1/illustration?w=400',
      unoptimized: true,
    });
  });

  it('asks the admin proxy for a thumbnail and leaves it unoptimized', () => {
    expect(cardImageProps('/api/admin/images/card-1/original', 200)).toEqual({
      src: '/api/admin/images/card-1/original?w=200',
      unoptimized: true,
    });
  });

  it('appends the width to a proxy URL that already carries a query string', () => {
    expect(cardImageProps('/api/boards/b1/preview?v=123', 400)).toEqual({
      src: '/api/boards/b1/preview?v=123&w=400',
      unoptimized: true,
    });
  });

  it('leaves SVG unoptimized', () => {
    // The optimizer 400s on SVG unless dangerouslyAllowSVG is enabled.
    expect(cardImageProps('/placeholder.svg', 400)).toEqual({
      src: '/placeholder.svg',
      unoptimized: true,
    });
  });

  it('passes base64 previews through untouched and unoptimized', () => {
    // Optimistic local preview while the upload is still in flight.
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    expect(cardImageProps(dataUrl, 400)).toEqual({ src: dataUrl, unoptimized: true });
  });
});
