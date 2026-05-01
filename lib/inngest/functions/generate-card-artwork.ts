import OpenAI, { toFile } from 'openai';
import { eq, sql } from 'drizzle-orm';
import { db, boards, cards } from '@/db';
import { uploadIllustration, fetchBlob } from '@/lib/blob';
import { ILLUSTRATION_PROMPT } from '@/lib/illustration-prompt';
import { normalizeImageForOpenAI } from '@/lib/image-normalize';

export const OPENAI_IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
import { inngest } from '../client';
import { cardGenerateRequested } from '../events';
import { cardChannel } from '../channels';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';
import { withAITrace } from '@/lib/ai-tracing';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const LABEL_SYSTEM_PROMPT =
  'You are an expert in Mexican culture and Loteria cards. Generate authentic Loteria-style labels in Spanish.';

const LABEL_USER_PROMPT = `Based on this image, generate a short Spanish word or phrase that would be perfect as a label for a Mexican Loteria card.

The label should be:
- 1-3 words maximum
- A noun or simple phrase
- Appropriate for a traditional Loteria card game
- In Spanish

Return ONLY the Spanish label, nothing else. Example labels: "El Diablo", "La Luna", "El Corazón"`;

export const generateCardArtwork = inngest.createFunction(
  {
    id: 'generate-card-artwork',
    triggers: [cardGenerateRequested],
    concurrency: { key: 'event.data.userId', limit: 3 },
    throttle: { key: 'event.data.userId', limit: 10, period: '1m' },
    retries: 2,
    optimizeParallelism: true,
    onFailure: async ({ event, error, step }) => {
      const { cardId } = event.data.event.data as { cardId: string };
      const message = error.message || 'Failed to generate card artwork';

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

    // Each branch refetches the original image inside its own step so the raw
    // bytes never cross a step boundary. Inngest caps step output at ~4MB, and
    // a large base64 PNG would exceed that.
    const labelPromise = (async () => {
      const label = await step.run('generate-label', async () => {
        const { buffer, contentType } = await fetchBlob(originalImageUrl);
        const mime = OPENAI_IMAGE_MIME_TO_EXT[contentType] ? contentType : 'image/png';
        const base64 = buffer.toString('base64');
        const labelModel = 'gpt-5-nano-2025-08-07';
        const result = await withAITrace(
          'generate-label',
          { userId, boardId, cardId, model: labelModel },
          () =>
            openai.chat.completions.create({
              model: labelModel,
              messages: [
                { role: 'system', content: LABEL_SYSTEM_PROMPT },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'image_url',
                      image_url: { url: `data:${mime};base64,${base64}` },
                    },
                    { type: 'text', text: LABEL_USER_PROMPT },
                  ],
                },
              ],
              max_completion_tokens: 500,
              reasoning_effort: 'minimal',
            })
        );
        return result.choices[0].message.content?.trim() || '';
      });
      await step.realtime.publish('publish-label', ch.label, { label });
      return label;
    })();

    const illustrationPromise = (async () => {
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
          'generate-illustration',
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
      await step.realtime.publish('publish-illustration', ch.illustration, { illustrationUrl });
      return illustrationUrl;
    })();

    const [label, illustrationUrl] = await Promise.all([labelPromise, illustrationPromise]);

    // neon-http has no transaction support; these two updates are run as
    // separate statements within the same step. Step-level retries are safe
    // because both updates are idempotent within this job (the card ends in
    // the same state), and Inngest won't fire retries for a step that already
    // succeeded.
    await step.run('persist-card', async () => {
      await db
        .update(cards)
        .set({
          label,
          illustrationUrl,
          status: 'completed',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, cardId));
    });

    await step.run('increment-generation-counter', async () => {
      await db
        .update(boards)
        .set({
          imageGenerationsUsed: sql`${boards.imageGenerationsUsed} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(boards.id, boardId));
    });

    await step.run('invalidate-preview', async () => {
      await invalidateBoardPreview(boardId, userId);
    });

    await step.realtime.publish('completed', ch.completed, { label, illustrationUrl });

    return { cardId, label, illustrationUrl };
  }
);
