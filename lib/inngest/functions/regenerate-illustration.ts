import OpenAI, { toFile } from 'openai';
import { eq } from 'drizzle-orm';
import { db, cards } from '@/db';
import { uploadIllustration, fetchBlob } from '@/lib/blob';
import { normalizeImageForOpenAI } from '@/lib/image-normalize';
import { inngest } from '../client';
import { illustrationRegenerateRequested } from '../events';
import { cardChannel } from '../channels';
import { OPENAI_IMAGE_MIME_TO_EXT } from './generate-card-artwork';
import { ILLUSTRATION_PROMPT } from '@/lib/illustration-prompt';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';
import { withAITrace } from '@/lib/ai-tracing';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const regenerateIllustration = inngest.createFunction(
  {
    id: 'regenerate-illustration',
    triggers: [illustrationRegenerateRequested],
    concurrency: { key: 'event.data.userId', limit: 1 },
    retries: 2,
    onFailure: async ({ event, error, step }) => {
      const { cardId } = event.data.event.data as { cardId: string };
      const message = error.message || 'Failed to regenerate illustration';

      await step.run('persist-error', async () => {
        await db
          .update(cards)
          .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
          .where(eq(cards.id, cardId));
      });

      const ch = cardChannel({ cardId });
      await step.realtime.publish('error', ch.error, { message });
    },
  },
  async ({ event, step }) => {
    const { cardId, boardId, userId, originalImageUrl } = event.data;
    const ch = cardChannel({ cardId });

    await step.run('set-processing', async () => {
      await db
        .update(cards)
        .set({ status: 'processing', errorMessage: null, updatedAt: new Date() })
        .where(eq(cards.id, cardId));
    });

    const illustrationUrl = await step.run('generate-and-upload-illustration', async () => {
      const { buffer, contentType } = await fetchBlob(originalImageUrl);
      if (!OPENAI_IMAGE_MIME_TO_EXT[contentType]) {
        throw new Error(
          `Unsupported image format "${contentType}". Please upload PNG, JPEG, WebP, or GIF.`
        );
      }
      const normalized = await normalizeImageForOpenAI(buffer);
      const imageFile = await toFile(normalized, 'image.png', { type: 'image/png' });
      const illustrationModel =
        process.env.NODE_ENV === 'production' ? 'gpt-image-1.5' : 'gpt-image-1-mini';
      const result = await withAITrace(
        'regenerate-illustration',
        { userId, boardId, cardId, model: illustrationModel },
        () =>
          openai.images.edit({
            model: illustrationModel,
            image: imageFile,
            prompt: ILLUSTRATION_PROMPT,
            size: '1024x1536',
          })
      );
      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error('Failed to generate illustration');
      const illustrationBuffer = Buffer.from(b64, 'base64');
      return uploadIllustration(userId, boardId, cardId, illustrationBuffer);
    });

    await step.run('persist-illustration', async () => {
      await db
        .update(cards)
        .set({
          illustrationUrl,
          status: 'completed',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, cardId));
    });

    await step.run('invalidate-preview', async () => {
      await invalidateBoardPreview(boardId, userId);
    });

    await step.realtime.publish('publish-illustration', ch.illustration, { illustrationUrl });

    return { cardId, illustrationUrl };
  }
);
