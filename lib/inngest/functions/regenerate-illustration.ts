import OpenAI, { toFile } from 'openai';
import { eq } from 'drizzle-orm';
import { db, cards } from '@/db';
import { uploadIllustration, fetchBlob } from '@/lib/blob';
import { normalizeImageForOpenAI } from '@/lib/image-normalize';
import { extractCrop } from '@/lib/crop-region';
import { inngest } from '../client';
import { illustrationRegenerateRequested } from '../events';
import { cardChannel, boardChannel } from '../channels';
import { isSupportedUploadMime } from '@/lib/image-formats';
import { buildIllustrationPrompt, ILLUSTRATION_MODEL } from '@/lib/illustration-prompt';
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
      const { cardId, boardId } = event.data.event.data as { cardId: string; boardId: string };
      const message = error.message || 'Failed to regenerate illustration';

      await step.run('persist-error', async () => {
        await db
          .update(cards)
          .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
          .where(eq(cards.id, cardId));
      });

      const ch = cardChannel({ cardId });
      await step.realtime.publish('error', ch.error, { message });
      await step.realtime.publish('publish-board-error', boardChannel({ boardId }).cardUpdated, {
        cardId,
        status: 'error',
        errorMessage: message,
      });
    },
  },
  async ({ event, step }) => {
    const { cardId, boardId, userId, originalImageUrl, promptOverlay } = event.data;
    const ch = cardChannel({ cardId });

    await step.run('set-processing', async () => {
      await db
        .update(cards)
        .set({ status: 'processing', errorMessage: null, updatedAt: new Date() })
        .where(eq(cards.id, cardId));
    });

    await step.realtime.publish('publish-board-processing', boardChannel({ boardId }).cardUpdated, {
      cardId,
      status: 'processing',
    });

    // Read from the row rather than the event so every sender (admin
    // regenerate, retry-failed) gets the same crop.
    const cropData = await step.run('load-crop', async () => {
      const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
      return card?.cropData ?? null;
    });

    const illustrationUrl = await step.run('generate-and-upload-illustration', async () => {
      const { buffer, contentType } = await fetchBlob(originalImageUrl);
      if (!isSupportedUploadMime(contentType)) {
        throw new Error(
          `Unsupported image format "${contentType}". Please upload PNG, JPEG, WebP, GIF, or AVIF.`
        );
      }
      // Crop before AI, as generate-card-artwork does. The AI drawing is then
      // served as-is, so it must not stay marked preserveOriginal (below).
      const sourceBuffer = cropData ? await extractCrop(buffer, cropData) : buffer;
      const normalized = await normalizeImageForOpenAI(sourceBuffer);
      const imageFile = await toFile(normalized, 'image.png', { type: 'image/png' });
      const illustrationModel = ILLUSTRATION_MODEL;
      const result = await withAITrace(
        'regenerate-illustration',
        { userId, boardId, cardId, model: illustrationModel },
        () =>
          openai.images.edit({
            model: illustrationModel,
            image: imageFile,
            prompt: buildIllustrationPrompt(promptOverlay),
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
          savedIllustrationUrl: illustrationUrl,
          status: 'completed',
          errorMessage: null,
          // cropData is kept so "Use original photo" can restore the same crop.
          preserveOriginal: false,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, cardId));
    });

    await step.run('invalidate-preview', async () => {
      await invalidateBoardPreview(boardId, userId);
    });

    await step.realtime.publish('publish-illustration', ch.illustration, { illustrationUrl });
    await step.realtime.publish('publish-board-completed', boardChannel({ boardId }).cardUpdated, {
      cardId,
      status: 'completed',
      illustrationUrl,
    });

    return { cardId, illustrationUrl };
  }
);
