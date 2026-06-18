import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, boards, userProfiles } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { createBoardSchema } from '@/lib/validations';
import { isAdminEmail } from '@/lib/admin';

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
      orderBy: [desc(boards.createdAt)],
      with: {
        cards: {
          columns: {
            id: true,
            number: true,
            status: true,
            illustrationUrl: true,
          },
        },
      },
    });

    const boardsWithCounts = userBoards.map((board) => {
      const sortedCards = [...board.cards].sort((a, b) => a.number - b.number);
      const previewCards = sortedCards
        .filter((c) => c.status === 'completed' && c.illustrationUrl)
        .slice(0, 16)
        .map((c) => ({ id: c.id, number: c.number }));

      return {
        id: board.id,
        name: board.name,
        isUnlocked: board.isUnlocked,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
        cardCount: board.cards.length,
        completedCardCount: board.cards.filter((c) => c.status === 'completed').length,
        previewCards,
      };
    });

    // Calculate board limits: user can have (unlockedCount + 1) boards total
    // This means they can always have exactly ONE unpaid board at a time
    const unlockedCount = userBoards.filter((b) => b.isUnlocked).length;
    const maxBoards = unlockedCount + 1;
    const canCreateBoard = userBoards.length < maxBoards;

    return NextResponse.json({
      boards: boardsWithCounts,
      limits: {
        current: userBoards.length,
        max: maxBoards,
        unlockedCount,
        canCreateBoard,
      },
    });
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
    const parsed = createBoardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name } = parsed.data;
    const isAdmin = isAdminEmail(session.user.email);

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

    // Check board limit: user can have (unlockedCount + 1) boards total
    // This means they can always have exactly ONE unpaid board at a time
    const existingBoards = await db.query.boards.findMany({
      where: eq(boards.userId, session.user.id),
    });

    const unlockedCount = existingBoards.filter((b) => b.isUnlocked).length;
    const maxBoards = unlockedCount + 1;

    if (!isAdmin && existingBoards.length >= maxBoards) {
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
        isUnlocked: isAdmin,
      })
      .returning();

    return NextResponse.json({ board: newBoard }, { status: 201 });
  } catch (error) {
    console.error('Error creating board:', error);
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
  }
}
