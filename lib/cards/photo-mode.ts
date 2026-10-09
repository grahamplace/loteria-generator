import { and, eq } from 'drizzle-orm';
import { db, cards, type Card } from '@/db';
import { inngest } from '@/lib/inngest/client';
import { cardGenerateRequested } from '@/lib/inngest/events';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';
import type { PhotoMode } from '@/lib/themes/presets';
import { findCardIllustration } from '@/lib/blob';

export class CardPhotoModeError extends Error {
  constructor(public code: 'NO_PHOTO' | 'BUSY' | 'CONFLICT' | 'QUEUE_FAILED') {
    super(code);
  }
}

/** Change the active face without discarding the drawing or original-photo crop. */
export async function changeCardPhotoMode(card: Card, mode: PhotoMode): Promise<Card> {
  if (card.isDefault || !card.originalImageUrl) throw new CardPhotoModeError('NO_PHOTO');
  if (card.status === 'processing' || card.status === 'pending')
    throw new CardPhotoModeError('BUSY');

  let savedIllustrationUrl =
    !card.preserveOriginal && card.illustrationUrl !== card.originalImageUrl
      ? (card.illustrationUrl ?? card.savedIllustrationUrl)
      : card.savedIllustrationUrl;
  if (mode === 'illustrated' && !savedIllustrationUrl)
    savedIllustrationUrl = await findCardIllustration(card.userId, card.boardId, card.id);
  const needsGeneration = mode === 'illustrated' && !savedIllustrationUrl;
  const [updated] = await db
    .update(cards)
    .set({
      preserveOriginal: mode === 'original',
      savedIllustrationUrl,
      illustrationUrl: mode === 'original' ? card.originalImageUrl : savedIllustrationUrl,
      status: needsGeneration ? 'processing' : 'completed',
      errorMessage: null,
      updatedAt: new Date(),
    })
    // Claim the transition before enqueueing: simultaneous requests cannot
    // start two paid generations or overwrite a different mode selection.
    .where(
      and(
        eq(cards.id, card.id),
        eq(cards.status, card.status),
        eq(cards.preserveOriginal, card.preserveOriginal)
      )
    )
    .returning();
  if (!updated) throw new CardPhotoModeError('CONFLICT');

  if (needsGeneration) {
    try {
      await inngest.send(
        cardGenerateRequested.create({
          cardId: card.id,
          boardId: card.boardId,
          userId: card.userId,
          originalImageUrl: card.originalImageUrl,
          skipLabeling: true,
          cropData: card.cropData ?? undefined,
        })
      );
    } catch (error) {
      // A failed queue request leaves the photo usable and allows a retry.
      await db
        .update(cards)
        .set({
          preserveOriginal: card.preserveOriginal,
          illustrationUrl: card.illustrationUrl,
          status: card.status,
          errorMessage: card.errorMessage,
          updatedAt: new Date(),
        })
        .where(and(eq(cards.id, card.id), eq(cards.status, 'processing')));
      console.error('Could not queue card illustration:', error);
      throw new CardPhotoModeError('QUEUE_FAILED');
    }
  }
  await invalidateBoardPreview(card.boardId, card.userId);
  return updated;
}
