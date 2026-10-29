import OpenAI, { toFile } from 'openai';
import { NonRetriableError } from 'inngest';
import { eq, sql } from 'drizzle-orm';
import { db, boards, cards, user } from '@/db';
import { uploadIllustration, fetchBlob } from '@/lib/blob';
import { buildIllustrationPrompt, ILLUSTRATION_MODEL } from '@/lib/illustration-prompt';
import { normalizeImageForOpenAI, convertForOpenAIVision } from '@/lib/image-normalize';
import { isSupportedUploadMime } from '@/lib/image-formats';
import { extractCrop } from '@/lib/crop-region';
import { isAdminEmail } from '@/lib/admin';
import { getPostHogClient } from '@/lib/posthog-server';
import { withSheetOverlay } from '@/lib/sheet-split';
import { toSheetDataUrl, detectSheet, extractSheet } from '@/lib/sheet-split-ai';
import { splitSheetCard, type SplitResult } from '@/lib/sheet-split-run';

/** Formats OpenAI's vision input reads directly; others are converted first. */
export const OPENAI_IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
import { inngest } from '../client';
import { cardGenerateRequested } from '../events';
import { cardChannel, boardChannel } from '../channels';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';
import { withAITrace } from '@/lib/ai-tracing';
import { safetyIdentifier } from '@/lib/openai-safety';
import { stopIfContentBlocked } from '@/lib/inngest/content-blocked';
import { IDENTIFIER_BLOCKED_PREFIX } from '@/lib/generation-error';
import { isOpenAIBlocked, markOpenAIBlocked } from '@/lib/openai-blocked';
import {
  LABEL_MODEL,
  LABEL_REASONING_EFFORT,
  LABEL_RESPONSE_FORMAT,
  LABEL_SYSTEM_PROMPT,
  LABEL_USER_PROMPT,
  parseLabelResponse,
} from '@/lib/card-label';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const LABEL_MAX_ATTEMPTS = 3;

export const generateCardArtwork = inngest.createFunction(
  {
    id: 'generate-card-artwork',
    triggers: [cardGenerateRequested],
    concurrency: { key: 'event.data.userId', limit: 3 },
    throttle: { key: 'event.data.userId', limit: 10, period: '1m' },
    retries: 2,
    optimizeParallelism: true,
    onFailure: async ({ event, error, step }) => {
      const { cardId, boardId, userId } = event.data.event.data as {
        cardId: string;
        boardId: string;
        userId: string;
      };
      const message = error.message || 'Failed to generate card artwork';

      if (message.startsWith(IDENTIFIER_BLOCKED_PREFIX)) {
        await step.run('mark-openai-blocked', async () => {
          console.error('OpenAI blocked a user safety_identifier', { userId, cardId });
          await markOpenAIBlocked(userId);
        });
      }

      await step.run('persist-error', async () => {
        await db
          .update(cards)
          .set({
            status: 'error',
            errorMessage: message,
            errorDismissedAt: null,
            updatedAt: new Date(),
          })
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
    const { cardId, boardId, userId, skipIllustration, skipSheetDetection, cropData } = event.data;
    let { originalImageUrl, skipLabeling } = event.data;
    const ch = cardChannel({ cardId });
    let fromSheet = Boolean(event.data.fromSheet);

    // A blocked user gets no AI calls: each one would fail and count against
    // the org. The original photo still works, so photo-only jobs go ahead.
    const blocked = await step.run('check-openai-blocked', () => isOpenAIBlocked(userId));
    if (blocked) {
      if (!skipIllustration) {
        throw new NonRetriableError(`${IDENTIFIER_BLOCKED_PREFIX}user is blocked by OpenAI`);
      }
      skipLabeling = true;
    }

    // Sheet split: an upload showing many lotería cards becomes one card per
    // picture. Any failure here falls through to the normal single-card path.
    // cropData is in full-image coordinates; it would be wrong against crop #1.
    if (!skipIllustration && !skipSheetDetection && !fromSheet && !cropData) {
      const sheetUrl = originalImageUrl;
      const meta = { userId, boardId, cardId };
      let isSheet = false;
      try {
        isSheet = await step.run('detect-sheet', async () => {
          let dataUrl: string;
          try {
            const { buffer } = await fetchBlob(sheetUrl);
            dataUrl = await toSheetDataUrl(buffer);
          } catch {
            return false;
          }
          return detectSheet(dataUrl, meta);
        });
      } catch (error) {
        // A killed or failed step must not fail the card: treat as not a sheet.
        console.error('detect-sheet step failed; continuing as a single card', { cardId, error });
      }

      if (isSheet) {
        await step.realtime.publish('publish-sheet-detected', ch.sheet, { phase: 'detected' });
        // Refetch inside the step: image bytes must never be a step output.
        let extraction: Awaited<ReturnType<typeof extractSheet>> = null;
        try {
          extraction = await step.run('extract-sheet', async () => {
            try {
              const { buffer } = await fetchBlob(sheetUrl);
              return await extractSheet(await toSheetDataUrl(buffer), meta);
            } catch {
              return null;
            }
          });
        } catch (error) {
          // Publishes `failed` below and continues as a single card.
          console.error('extract-sheet step failed; continuing as a single card', {
            cardId,
            error,
          });
        }

        let split: SplitResult | null = null;
        if (extraction && extraction.cards.length >= 2) {
          try {
            split = await step.run('split-sheet', async () => {
              const owner = await db.query.user.findFirst({
                where: eq(user.id, userId),
                columns: { email: true },
              });
              return splitSheetCard({
                cardId,
                boardId,
                userId,
                isAdmin: isAdminEmail(owner?.email),
                originalImageUrl: sheetUrl,
                extraction,
              });
            });
          } catch (error) {
            // Retries exhausted; splitSheetCard already removed any cards it added.
            console.error('split-sheet failed; continuing as a single card', { cardId, error });
            split = null;
            // The split may have got far enough to mark the card fromSheet and
            // replace original.png with crop #1 and its title: follow the row.
            const row = await step.run('reload-after-failed-split', async () => {
              const card = await db.query.cards.findFirst({
                where: eq(cards.id, cardId),
                columns: { fromSheet: true, label: true, originalImageUrl: true },
              });
              return card ?? null;
            });
            if (row?.fromSheet) {
              fromSheet = true;
              if (row.originalImageUrl) originalImageUrl = row.originalImageUrl;
              if (row.label?.trim()) skipLabeling = true;
            }
          }
        }

        if (!split || split.status === 'no-slots') {
          await step.realtime.publish('publish-sheet-failed', ch.sheet, { phase: 'failed' });
        } else if (split.status === 'all-duplicates') {
          // splitSheetCard deleted the uploaded card: nothing left to illustrate.
          await step.realtime.publish('publish-sheet-split', ch.sheet, {
            phase: 'split',
            foundCount: split.foundCount,
            createdCount: 0,
            skippedCount: split.skippedCount,
          });
          return { cardId, split: 'all-duplicates' as const };
        } else {
          const { others, first, foundCount, createdCount, skippedCount } = split;
          if (others.length > 0) {
            await step.sendEvent(
              'fan-out-sheet-cards',
              others.map((o) =>
                cardGenerateRequested.create({
                  cardId: o.cardId,
                  boardId,
                  userId,
                  originalImageUrl: o.originalImageUrl,
                  skipLabeling: o.titled,
                  fromSheet: true,
                })
              )
            );
          }
          originalImageUrl = first.originalImageUrl;
          skipLabeling = first.titled;
          fromSheet = true;
          await step.realtime.publish('publish-sheet-split', ch.sheet, {
            phase: 'split',
            foundCount,
            createdCount,
            skippedCount,
          });
          await step.run('track-sheet', async () => {
            const posthog = getPostHogClient();
            if (!posthog) return;
            try {
              const board = await db.query.boards.findFirst({
                where: eq(boards.id, boardId),
                columns: { isUnlocked: true },
              });
              posthog.capture({
                distinctId: userId,
                event: 'sheet_detected',
                properties: {
                  board_id: boardId,
                  found_count: foundCount,
                  created_count: createdCount,
                  skipped_count: skippedCount,
                  board_is_unlocked: board?.isUnlocked ?? false,
                },
              });
              await posthog.shutdown();
            } catch (error) {
              // Analytics must never fail the card.
              console.error('track-sheet: analytics failed', { cardId, error });
            }
          });
        }
      }
    }

    // Each branch refetches the original image inside its own step so the raw
    // bytes never cross a step boundary. Inngest caps step output at ~4MB, and
    // a large base64 PNG would exceed that.
    const labelPromise = (async () => {
      if (skipLabeling) {
        const label = await step.run('load-existing-label', async () => {
          const card = await db.query.cards.findFirst({
            where: eq(cards.id, cardId),
            columns: { label: true },
          });
          return card?.label ?? '';
        });
        await step.realtime.publish('publish-label', ch.label, { label });
        return label;
      }

      const label = await step.run('generate-label', async () => {
        const { buffer: original, contentType } = await fetchBlob(originalImageUrl);
        const visionReadable = Boolean(OPENAI_IMAGE_MIME_TO_EXT[contentType]);
        const buffer = visionReadable ? original : await convertForOpenAIVision(original);
        const mime = visionReadable ? contentType : 'image/jpeg';
        const base64 = buffer.toString('base64');
        const labelModel = LABEL_MODEL;
        const rejected: (string | null)[] = [];

        for (let attempt = 1; attempt <= LABEL_MAX_ATTEMPTS; attempt++) {
          const result = await withAITrace(
            'generate-label',
            { userId, boardId, cardId, model: labelModel },
            () =>
              openai.chat.completions.create({
                model: labelModel,
                ...safetyIdentifier(userId),
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
                response_format: LABEL_RESPONSE_FORMAT,
                max_completion_tokens: 500,
                reasoning_effort: LABEL_REASONING_EFFORT,
              })
          ).catch(stopIfContentBlocked);
          const choice = result.choices[0];
          const content = choice?.message.content ?? null;
          // A truncated response can still parse if it happens to cut at a
          // valid boundary, so never trust one.
          const label = choice?.finish_reason === 'length' ? null : parseLabelResponse(content);
          if (label) return label;
          rejected.push(content);
        }

        // A blank label is editable by the user; a garbage one looks broken.
        console.warn('generate-label: no valid label after retries', { cardId, rejected });
        return '';
      });
      await step.realtime.publish('publish-label', ch.label, { label });
      return label;
    })();

    const illustrationPromise = (async () => {
      if (skipIllustration) {
        // Preserve the uploaded (cropped) photo as the card face — no AI.
        await step.realtime.publish('publish-illustration', ch.illustration, {
          illustrationUrl: originalImageUrl,
        });
        return originalImageUrl;
      }

      const illustrationUrl = await step.run('generate-and-upload-illustration', async () => {
        const { buffer, contentType } = await fetchBlob(originalImageUrl);
        if (!isSupportedUploadMime(contentType)) {
          throw new Error(
            `Unsupported image format "${contentType}". Please upload PNG, JPEG, WebP, GIF, or AVIF.`
          );
        }
        const sourceBuffer = cropData ? await extractCrop(buffer, cropData) : buffer;
        const normalized = await normalizeImageForOpenAI(sourceBuffer);
        const imageFile = await toFile(normalized, 'image.png', { type: 'image/png' });
        const illustrationModel = ILLUSTRATION_MODEL;
        const result = await withAITrace(
          'generate-illustration',
          { userId, boardId, cardId, model: illustrationModel },
          () =>
            openai.images.edit({
              model: illustrationModel,
              image: imageFile,
              prompt: buildIllustrationPrompt(withSheetOverlay(fromSheet)),
              size: '1024x1536',
              ...safetyIdentifier(userId),
            })
        ).catch(stopIfContentBlocked);
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
          ...(skipLabeling ? {} : { label }),
          illustrationUrl,
          ...(skipIllustration ? {} : { savedIllustrationUrl: illustrationUrl }),
          status: 'completed',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, cardId));
    });

    if (!skipIllustration) {
      await step.run('increment-generation-counter', async () => {
        await db
          .update(boards)
          .set({
            imageGenerationsUsed: sql`${boards.imageGenerationsUsed} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(boards.id, boardId));
      });
    }

    await step.run('invalidate-preview', async () => {
      await invalidateBoardPreview(boardId, userId);
    });

    await step.realtime.publish('completed', ch.completed, { label, illustrationUrl });
    await step.realtime.publish('publish-board-completed', boardChannel({ boardId }).cardUpdated, {
      cardId,
      status: 'completed',
      illustrationUrl,
    });

    return { cardId, label, illustrationUrl };
  }
);
