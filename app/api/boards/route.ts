import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, boards, userProfiles } from '@/db';
import { eq, desc } from 'drizzle-orm';

// Constants for free tier limits
const MAX_BOARDS_FREE = 1;

/**
 * GET /api/boards - List all boards for the current user
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userBoards = await db.query.boards.findMany({
      where: eq(boards.userId, session.user.id),
      orderBy: [desc(boards.updatedAt)],
      with: {
        cards: {
          columns: {
            id: true,
            status: true,
          },
        },
      },
    });

    // Transform to include card counts
    const boardsWithCounts = userBoards.map((board) => ({
      id: board.id,
      name: board.name,
      isUnlocked: board.isUnlocked,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      cardCount: board.cards.length,
      completedCardCount: board.cards.filter((c) => c.status === 'completed').length,
    }));

    return NextResponse.json({ boards: boardsWithCounts });
  } catch (error) {
    console.error('Error fetching boards:', error);
    return NextResponse.json({ error: 'Failed to fetch boards' }, { status: 500 });
  }
}

/**
 * POST /api/boards - Create a new board
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    // Ensure user profile exists
    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, session.user.id),
    });

    if (!existingProfile) {
      // Create user profile on first board creation
      await db.insert(userProfiles).values({
        id: session.user.id,
      });
    }

    // Check board limit for users without any unlocked boards
    const existingBoards = await db.query.boards.findMany({
      where: eq(boards.userId, session.user.id),
    });

    const hasUnlockedBoard = existingBoards.some((b) => b.isUnlocked);

    if (!hasUnlockedBoard && existingBoards.length >= MAX_BOARDS_FREE) {
      return NextResponse.json(
        {
          error: 'Board limit reached',
          message: 'Unlock your current board to create more boards',
          code: 'BOARD_LIMIT_REACHED',
        },
        { status: 403 }
      );
    }

    // Create the board
    const [newBoard] = await db
      .insert(boards)
      .values({
        userId: session.user.id,
        name: name || 'My Loteria Board',
      })
      .returning();

    return NextResponse.json({ board: newBoard }, { status: 201 });
  } catch (error) {
    console.error('Error creating board:', error);
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
  }
}
