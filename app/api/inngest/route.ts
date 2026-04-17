import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { generateCardArtwork } from '@/lib/inngest/functions/generate-card-artwork';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateCardArtwork],
});
