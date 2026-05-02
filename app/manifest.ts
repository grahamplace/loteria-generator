import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lotería Generator - Custom Mexican Lotería Cards',
    short_name: 'Lotería Generator',
    description:
      'Create personalized Mexican Lotería cards from your photos. Perfect for weddings, quinceañeras, and family celebrations.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f0e1',
    theme_color: '#c8362e',
    orientation: 'portrait',
    categories: ['entertainment', 'lifestyle', 'utilities'],
    lang: 'en',
    icons: [
      {
        src: '/icon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
