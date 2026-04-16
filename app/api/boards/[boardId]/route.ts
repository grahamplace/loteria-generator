import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, boards, IMAGE_GENERATION_LIMIT_FREE, IMAGE_GENERATION_LIMIT_PAID } from '@/db';
import { eq, and } from 'drizzle-orm';
import { deleteBoardImages } from '@/lib/blob';
import { updateBoardSchema } from '@/lib/validations';

/**
 * GET /api/boards/[boardId] - Get a single board with its cards
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

    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
      with: {
        cards: {
          orderBy: (cards, { asc }) => [asc(cards.number)],
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Include generation limit info
    const generationLimit = board.isUnlocked
      ? IMAGE_GENERATION_LIMIT_PAID
      : IMAGE_GENERATION_LIMIT_FREE;
    const generationsRemaining = Math.max(0, generationLimit - board.imageGenerationsUsed);

    return NextResponse.json({
      board,
      generationLimit,
      generationsRemaining,
    });
  } catch (error) {
    console.error('Error fetching board:', error);
    return NextResponse.json({ error: 'Failed to fetch board' }, { status: 500 });
  }
}

/**
 * PATCH /api/boards/[boardId] - Update a board
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
    const parsed = updateBoardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, styleOptions } = parsed.data;

    // Verify ownership
    const existingBoard = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });

    if (!existingBoard) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Build update object
    const updateData: Partial<typeof boards.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = name;
    }

    if (styleOptions !== undefined) {
      updateData.styleOptions = styleOptions;
    }

    const [updatedBoard] = await db
      .update(boards)
      .set(updateData)
      .where(eq(boards.id, boardId))
      .returning();

    return NextResponse.json({ board: updatedBoard });
  } catch (error) {
    console.error('Error updating board:', error);
    return NextResponse.json({ error: 'Failed to update board' }, { status: 500 });
  }
}

/**
 * DELETE /api/boards/[boardId] - Delete a board and all its cards
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

    // Verify ownership
    const existingBoard = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });

    if (!existingBoard) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Delete all images from blob storage
    try {
      await deleteBoardImages(session.user.id, boardId);
    } catch (blobError) {
      console.error('Error deleting board images:', blobError);
      // Continue with board deletion even if blob cleanup fails
    }

    // Delete the board (cards will cascade delete)
    await db.delete(boards).where(eq(boards.id, boardId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting board:', error);
    return NextResponse.json({ error: 'Failed to delete board' }, { status: 500 });
  }
}
