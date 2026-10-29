import { and, eq } from 'drizzle-orm';
import { db, cards, getGenerationLimit, type Board, type Card } from '@/db';
import { inngest } from '@/lib/inngest/client';
import { cardGenerateRequested } from '@/lib/inngest/events';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';

export const REILLUSTRATE_NOTES_MAX = 500;

export class CardReillustrateError extends Error {
  constructor(
    public code: 'NO_PHOTO' | 'BUSY' | 'CONFLICT' | 'QUEUE_FAILED' | 'GENERATION_LIMIT_REACHED'
  ) {
    super(code);
  }
}

/** Save the owner's notes and regenerate the illustration from the original photo. */
export async function reillustrateCard(
  card: Card,
  board: Board,
  notes: string | null,
  opts: { isAdmin: boolean }
): Promise<Card> {
  if (card.isDefault || !card.originalImageUrl) throw new CardReillustrateError('NO_PHOTO');
  if (card.status === 'processing' || card.status === 'pending')
    throw new CardReillustrateError('BUSY');
  if (!opts.isAdmin && board.imageGenerationsUsed >= getGenerationLimit(board))
    throw new CardReillustrateError('GENERATION_LIMIT_REACHED');

  // Notes are persisted in the claim: the generation job reads promptOverlay
  // from the card row, so they must be saved before the event is sent.
  const [updated] = await db
    .update(cards)
    .set({
      status: 'processing',
      promptOverlay: notes,
      preserveOriginal: false,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(cards.id, card.id), eq(cards.status, card.status)))
    .returning();
  if (!updated) throw new CardReillustrateError('CONFLICT');

  try {
    await inngest.send(
      cardGenerateRequested.create({
        cardId: card.id,
        boardId: card.boardId,
        userId: card.userId,
        originalImageUrl: card.originalImageUrl,
        skipLabeling: true,
        cropData: card.cropData ?? undefined,
        fromSheet: card.fromSheet,
        skipSheetDetection: true,
      })
    );
  } catch (error) {
    // Notes stay saved; only the generation state is restored for a retry.
    await db
      .update(cards)
      .set({
        status: card.status,
        preserveOriginal: card.preserveOriginal,
        errorMessage: card.errorMessage,
        updatedAt: new Date(),
      })
      .where(and(eq(cards.id, card.id), eq(cards.status, 'processing')));
    console.error('Could not queue card re-illustration:', error);
    throw new CardReillustrateError('QUEUE_FAILED');
  }
  await invalidateBoardPreview(card.boardId, card.userId);
  return updated;
}
