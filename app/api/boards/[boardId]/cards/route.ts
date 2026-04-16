import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, boards, cards } from '@/db';
import { eq, and, max, gt, sql } from 'drizzle-orm';
import {
  uploadOriginalImage,
  uploadIllustration,
  deleteCardImages,
  base64ToBuffer,
  getContentTypeFromDataUrl,
} from '@/lib/blob';
import { createCardSchema, updateCardSchema } from '@/lib/validations';

// Constants for limits
const MAX_CARDS_FREE = 16;
const MAX_CARDS_UNLOCKED = 54;

/**
 * GET /api/boards/[boardId]/cards - List all cards for a board
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = await params;

    // Verify board ownership
    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const boardCards = await db.query.cards.findMany({
      where: eq(cards.boardId, boardId),
      orderBy: (cards, { asc }) => [asc(cards.number)],
    });

    return NextResponse.json({ cards: boardCards });
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
  }
}

/**
 * POST /api/boards/[boardId]/cards - Create a new card
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = await params;
    const body = await request.json();
    const parsed = createCardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { originalImageBase64, label } = parsed.data;

    // Verify board ownership
    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Check card limit
    const existingCards = await db.query.cards.findMany({
      where: eq(cards.boardId, boardId),
    });

    const maxCards = board.isUnlocked ? MAX_CARDS_UNLOCKED : MAX_CARDS_FREE;

    if (existingCards.length >= maxCards) {
      return NextResponse.json(
        {
          error: 'Card limit reached',
          message: board.isUnlocked
            ? `Maximum of ${MAX_CARDS_UNLOCKED} cards allowed`
            : `Unlock this board to add more than ${MAX_CARDS_FREE} cards`,
          code: 'CARD_LIMIT_REACHED',
        },
        { status: 403 }
      );
    }

    // Create card with next number in a transaction to avoid race conditions
    // during multi-file uploads where concurrent POSTs could read the same max
    const [newCard] = await db.transaction(async (tx) => {
      const maxNumberResult = await tx
        .select({ maxNumber: max(cards.number) })
        .from(cards)
        .where(eq(cards.boardId, boardId));

      const nextNumber = (maxNumberResult[0]?.maxNumber || 0) + 1;

      return tx
        .insert(cards)
        .values({
          boardId,
          userId: session.user.id,
          number: nextNumber,
          label: label || '',
          status: 'pending',
        })
        .returning();
    });

    // Upload original image to blob storage if provided
    if (originalImageBase64) {
      try {
        const buffer = base64ToBuffer(originalImageBase64);
        const contentType = getContentTypeFromDataUrl(originalImageBase64);

        const originalUrl = await uploadOriginalImage(
          session.user.id,
          boardId,
          newCard.id,
          buffer,
          contentType
        );

        // Update card with image URL
        await db
          .update(cards)
          .set({ originalImageUrl: originalUrl })
          .where(eq(cards.id, newCard.id));

        newCard.originalImageUrl = originalUrl;
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        // Card was created, but image upload failed
        await db
          .update(cards)
          .set({ status: 'error', errorMessage: 'Failed to upload image' })
          .where(eq(cards.id, newCard.id));
      }
    }

    return NextResponse.json({ card: newCard }, { status: 201 });
  } catch (error) {
    console.error('Error creating card:', error);
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 });
  }
}

/**
 * PATCH /api/boards/[boardId]/cards - Update a card
 * Body: { cardId, label?, illustrationBase64?, status? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = await params;
    const body = await request.json();
    const parsed = updateCardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { cardId, label, illustrationBase64, status, errorMessage } = parsed.data;

    // Verify ownership
    const card = await db.query.cards.findFirst({
      where: and(
        eq(cards.id, cardId),
        eq(cards.boardId, boardId),
        eq(cards.userId, session.user.id)
      ),
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Build update object
    const updateData: Partial<typeof cards.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (label !== undefined) {
      updateData.label = label;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }

    // Upload illustration if provided
    if (illustrationBase64) {
      try {
        const buffer = base64ToBuffer(illustrationBase64);
        const illustrationUrl = await uploadIllustration(session.user.id, boardId, cardId, buffer);
        updateData.illustrationUrl = illustrationUrl;
      } catch (uploadError) {
        console.error('Error uploading illustration:', uploadError);
        updateData.status = 'error';
        updateData.errorMessage = 'Failed to upload illustration';
      }
    }

    const [updatedCard] = await db
      .update(cards)
      .set(updateData)
      .where(eq(cards.id, cardId))
      .returning();

    return NextResponse.json({ card: updatedCard });
  } catch (error) {
    console.error('Error updating card:', error);
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 });
  }
}

/**
 * DELETE /api/boards/[boardId]/cards - Delete a card
 * Query param: cardId
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = await params;
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');

    if (!cardId) {
      return NextResponse.json({ error: 'Card ID required' }, { status: 400 });
    }

    // Verify ownership
    const card = await db.query.cards.findFirst({
      where: and(
        eq(cards.id, cardId),
        eq(cards.boardId, boardId),
        eq(cards.userId, session.user.id)
      ),
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Delete images from blob storage
    try {
      await deleteCardImages(session.user.id, boardId, cardId);
    } catch (blobError) {
      console.error('Error deleting card images:', blobError);
    }

    const deletedCardNumber = card.number;

    // Delete the card
    await db.delete(cards).where(eq(cards.id, cardId));

    // Renumber remaining cards: decrement all cards with number > deleted card's number
    await db
      .update(cards)
      .set({
        number: sql`${cards.number} - 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(cards.boardId, boardId), gt(cards.number, deletedCardNumber)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting card:', error);
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 });
  }
}
