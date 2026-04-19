import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, boards, cards } from '@/db';
import { eq, and } from 'drizzle-orm';
import { fetchBlobBuffer, uploadBoardPreview, getPrivateBlob } from '@/lib/blob';
import sharp from 'sharp';

const GRID_COLS = 4;
const GRID_ROWS = 4;
const CELL_W = 120;
const CELL_H = 180;
const GAP = 4;
const CANVAS_W = CELL_W * GRID_COLS + GAP * (GRID_COLS - 1);
const CANVAS_H = CELL_H * GRID_ROWS + GAP * (GRID_ROWS - 1);

/**
 * GET /api/boards/[boardId]/preview
 * Returns a single composite image of the board's card illustrations in a 4×4 grid.
 * Caches the result in Vercel Blob so subsequent requests are fast.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { boardId } = await params;

    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });

    if (!board) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Serve cached preview if available
    if (board.previewUrl) {
      try {
        const result = await getPrivateBlob(board.previewUrl);
        if (result?.statusCode === 200) {
          return new NextResponse(result.stream, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'private, max-age=3600',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        }
      } catch {
        // Cache miss or blob deleted — regenerate below
      }
    }

    // Fetch completed cards
    const boardCards = await db.query.cards.findMany({
      where: and(eq(cards.boardId, boardId)),
      columns: { id: true, number: true, illustrationUrl: true, status: true },
    });

    const completedCards = boardCards
      .filter((c) => c.status === 'completed' && c.illustrationUrl)
      .sort((a, b) => a.number - b.number)
      .slice(0, 16);

    if (completedCards.length === 0) {
      // Return a transparent 1×1 pixel
      const pixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRElEQg==',
        'base64'
      );
      return new NextResponse(new Uint8Array(pixel), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-cache' },
      });
    }

    // Fetch all card images in parallel
    const imageBuffers = await Promise.all(
      completedCards.map(async (card) => {
        try {
          const buf = await fetchBlobBuffer(card.illustrationUrl!);
          return await sharp(buf)
            .resize(CELL_W, CELL_H, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();
        } catch {
          return null;
        }
      })
    );

    // Composite into a single image with ghost cells for empty slots
    const ghostCell = await sharp({
      create: {
        width: CELL_W,
        height: CELL_H,
        channels: 4,
        background: { r: 230, g: 225, b: 215, alpha: 255 },
      },
    })
      .png()
      .toBuffer();

    const compositeInputs: sharp.OverlayOptions[] = [];

    for (let i = 0; i < GRID_ROWS * GRID_COLS; i++) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const left = col * (CELL_W + GAP);
      const top = row * (CELL_H + GAP);

      const buf = i < imageBuffers.length ? imageBuffers[i] : null;
      compositeInputs.push({
        input: buf || ghostCell,
        left,
        top,
      });
    }

    const compositeBuffer = await sharp({
      create: {
        width: CANVAS_W,
        height: CANVAS_H,
        channels: 3,
        background: { r: 240, g: 235, b: 226 },
      },
    })
      .composite(compositeInputs)
      .jpeg({ quality: 85 })
      .toBuffer();

    // Cache in Vercel Blob
    try {
      const previewUrl = await uploadBoardPreview(session.user.id, boardId, compositeBuffer);
      await db.update(boards).set({ previewUrl }).where(eq(boards.id, boardId));
    } catch (e) {
      console.error('Failed to cache board preview:', e);
      // Non-fatal — still serve the generated image
    }

    return new NextResponse(new Uint8Array(compositeBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Board preview error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
