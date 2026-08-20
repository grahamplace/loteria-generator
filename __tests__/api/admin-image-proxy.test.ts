import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/admin', () => ({
  isAdminEmail: vi.fn(() => true),
}));

vi.mock('@/db', () => ({
  db: { query: { cards: { findFirst: vi.fn() } } },
  cards: { id: 'id' },
}));

vi.mock('@/lib/blob', () => ({
  getPrivateBlob: vi.fn(),
}));

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { getPrivateBlob } from '@/lib/blob';
import { GET } from '@/app/api/admin/images/[cardId]/[type]/route';

/** Stands in for a stored illustration: 1024×1536, the size the pipeline emits. */
async function sourcePng() {
  return sharp({
    create: {
      width: 1024,
      height: 1536,
      channels: 3,
      background: { r: 200, g: 60, b: 40 },
    },
  })
    .png()
    .toBuffer();
}

function blobResult(buf: Buffer, etag = 'etag-1') {
  return {
    statusCode: 200,
    blob: { etag, contentType: 'image/png' },
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(buf));
        controller.close();
      },
    }),
  };
}

function makeReq(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

const params = Promise.resolve({ cardId: 'card-1', type: 'illustration' });

describe('GET /api/admin/images/[cardId]/[type]', () => {
  beforeEach(async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'u1', email: 'admin@example.com' },
    } as any);
    vi.mocked(db.query.cards.findFirst).mockResolvedValue({
      id: 'card-1',
      illustrationUrl: 'https://x.private.blob.vercel-storage.com/card-1.png',
      originalImageUrl: null,
      preserveOriginal: false,
      cropData: null,
    } as any);
    vi.mocked(getPrivateBlob).mockImplementation(async () => blobResult(await sourcePng()) as any);
  });

  it('returns a width-constrained webp when ?w= is set', async () => {
    const res = await GET(makeReq('http://localhost/api/admin/images/card-1/illustration?w=400'), {
      params,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');

    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(400);
  });

  it('is dramatically smaller than the full-size source', async () => {
    const full = await sourcePng();
    const res = await GET(makeReq('http://localhost/api/admin/images/card-1/illustration?w=400'), {
      params,
    });
    const thumb = Buffer.from(await res.arrayBuffer());
    expect(thumb.byteLength).toBeLessThan(full.byteLength / 10);
  });

  it('serves the untouched blob when no width is requested', async () => {
    const res = await GET(makeReq('http://localhost/api/admin/images/card-1/illustration'), {
      params,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('varies the ETag by width so a different thumbnail is not served from cache', async () => {
    const a = await GET(makeReq('http://localhost/api/admin/images/card-1/illustration?w=400'), {
      params,
    });
    const b = await GET(makeReq('http://localhost/api/admin/images/card-1/illustration?w=200'), {
      params,
    });
    expect(a.headers.get('ETag')).not.toBe(b.headers.get('ETag'));
  });

  it('answers a matching If-None-Match with 304 and no body', async () => {
    const first = await GET(
      makeReq('http://localhost/api/admin/images/card-1/illustration?w=400'),
      { params }
    );
    const etag = first.headers.get('ETag')!;

    const second = await GET(
      makeReq('http://localhost/api/admin/images/card-1/illustration?w=400', {
        'if-none-match': etag,
      }),
      { params }
    );
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  });

  it('is cacheable by the browser but never by a shared cache', async () => {
    const res = await GET(makeReq('http://localhost/api/admin/images/card-1/illustration?w=400'), {
      params,
    });
    const cc = res.headers.get('Cache-Control')!;
    expect(cc).toContain('private');
    expect(cc).toMatch(/max-age=\d+/);
  });

  it('refuses non-admin callers', async () => {
    const { isAdminEmail } = await import('@/lib/admin');
    vi.mocked(isAdminEmail).mockReturnValueOnce(false);
    const res = await GET(makeReq('http://localhost/api/admin/images/card-1/illustration?w=400'), {
      params,
    });
    expect(res.status).toBe(404);
  });
});
