import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { generateCardArtwork } from '@/lib/inngest/functions/generate-card-artwork';
import { regenerateIllustration } from '@/lib/inngest/functions/regenerate-illustration';
import { signupNudgeEmail } from '@/lib/inngest/functions/signup-nudge-email';
import { reengagementEmail } from '@/lib/inngest/functions/reengagement-email';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateCardArtwork, regenerateIllustration, signupNudgeEmail, reengagementEmail],
});
