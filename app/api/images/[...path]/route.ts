import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, cards, boards } from '@/db';
import { eq, and } from 'drizzle-orm';
import { getPrivateBlob } from '@/lib/blob';
import sharp from 'sharp';
import { cropExtractRegion } from '@/lib/crop-math';

// Upper bound on the on-the-fly resize width. Stored illustrations are
// 1024×1536 PNGs (~2-4MB); the board grid only renders them ~180px wide, so a
// `?w=` thumbnail request collapses that to a few KB of webp.
const MAX_RESIZE_WIDTH = 1536;

function parseResizeWidth(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 16) return null;
  return Math.min(n, MAX_RESIZE_WIDTH);
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Private image proxy - serves images from Vercel Blob with auth check
 * URL pattern: /api/images/{boardId}/{cardId}/{type}
 * where type is 'original' or 'illustration'
 *
 * Optional `?w=<px>` query param returns a width-constrained webp thumbnail
 * instead of the full-size source, for grid/preview rendering.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Get the session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const pathParts = (await params).path;

    if (pathParts.length < 3) {
      return new NextResponse('Invalid path', { status: 400 });
    }

    const [boardId, cardId, type] = pathParts;

    if (type !== 'original' && type !== 'illustration') {
      return new NextResponse('Invalid image type', { status: 400 });
    }

    // Verify the user owns this board
    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });

    if (!board) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Get the card to retrieve the image URL
    const card = await db.query.cards.findFirst({
      where: and(eq(cards.id, cardId), eq(cards.boardId, boardId)),
    });

    if (!card) {
      return new NextResponse('Card not found', { status: 404 });
    }

    const imageUrl = type === 'original' ? card.originalImageUrl : card.illustrationUrl;

    if (!imageUrl) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const isPrivateBlob = imageUrl.includes('.private.blob.vercel-storage.com');

    if (isPrivateBlob) {
      // Fetch private blob using the SDK (authenticates with PRIVATE_BLOB_READ_WRITE_TOKEN)
      const result = await getPrivateBlob(imageUrl);

      if (result?.statusCode !== 200 || !result.stream) {
        return new NextResponse('Failed to fetch image', { status: 500 });
      }

      const resizeWidth = parseResizeWidth(request.nextUrl.searchParams.get('w'));
      const cropRect =
        type === 'illustration' && card.preserveOriginal && card.cropData ? card.cropData : null;

      if (resizeWidth || cropRect) {
        const cropSig = cropRect
          ? `-crop${cropRect.x}-${cropRect.y}-${cropRect.width}-${cropRect.height}`
          : '';
        const widthSig = resizeWidth ? `-w${resizeWidth}-webp` : '';
        const etag = `"${result.blob.etag}${cropSig}${widthSig}"`;
        if (request.headers.get('if-none-match') === etag) {
          return new NextResponse(null, {
            status: 304,
            headers: { ETag: etag, 'Cache-Control': 'private, no-cache' },
          });
        }

        const source = await streamToBuffer(result.stream);
        let pipeline = sharp(source).rotate();
        if (cropRect) {
          const meta = await sharp(source).metadata();
          const region = cropExtractRegion(cropRect, meta.width ?? 0, meta.height ?? 0);
          if (region) pipeline = pipeline.extract(region);
        }
        if (resizeWidth) {
          pipeline = pipeline.resize({ width: resizeWidth, withoutEnlargement: true });
        }
        const out = resizeWidth
          ? await pipeline.webp({ quality: 75 }).toBuffer()
          : await pipeline.png().toBuffer();

        return new NextResponse(new Uint8Array(out), {
          headers: {
            'Content-Type': resizeWidth ? 'image/webp' : 'image/png',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, no-cache',
            ETag: etag,
          },
        });
      }

      return new NextResponse(result.stream, {
        headers: {
          'Content-Type': result.blob.contentType,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-cache',
          ETag: result.blob.etag,
        },
      });
    }

    // Legacy public blob — fetch directly (migration period)
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return new NextResponse('Failed to fetch image', { status: 500 });
    }

    return new NextResponse(imageResponse.body, {
      headers: {
        'Content-Type': imageResponse.headers.get('content-type') || 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
