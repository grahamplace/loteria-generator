import { test, expect } from '@playwright/test';
import { db, cards } from '@/db';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';
import { eq } from 'drizzle-orm';

test('photo mode round trip persists on a free board and respects ownership and processing locks', async ({
  page,
}) => {
  const userId = await getUserIdByEmail('e2etest@example.com');
  await deleteBoardsForUser(userId);
  try {
    const board = await seedBoard({ userId, name: 'Photo mode API' });
    const photo = 'https://example.com/original.png';
    const drawing = 'https://example.com/illustration.png';
    const [card] = await db
      .insert(cards)
      .values({
        userId,
        boardId: board.id,
        number: 1,
        label: 'La Familia',
        riddle: 'Our verse',
        originalImageUrl: photo,
        illustrationUrl: drawing,
        status: 'completed',
      })
      .returning();
    const endpoint = `/api/boards/${board.id}/cards/${card.id}/photo-mode`;
    const cropData = { x: 5, y: 10, width: 100, height: 150 };
    const original = await page.request.post(endpoint, { data: { photoMode: 'original' } });
    expect(original.status()).toBe(200);
    expect((await original.json()).card).toMatchObject({
      preserveOriginal: true,
      illustrationUrl: photo,
      savedIllustrationUrl: drawing,
    });
    expect(
      (
        await page.request.patch(`/api/boards/${board.id}/cards`, {
          data: { cardId: card.id, cropData },
        })
      ).ok()
    ).toBe(true);
    const restored = await page.request.post(endpoint, { data: { photoMode: 'illustrated' } });
    expect(restored.status()).toBe(200);
    const data = (await restored.json()).card;
    expect(data).toMatchObject({
      preserveOriginal: false,
      illustrationUrl: drawing,
      cropData,
      label: 'La Familia',
      riddle: 'Our verse',
      status: 'completed',
    });
    const otherBoard = await seedBoard({ userId, name: 'Other board' });
    expect(
      (
        await page.request.post(`/api/boards/${otherBoard.id}/cards/${card.id}/photo-mode`, {
          data: { photoMode: 'original' },
        })
      ).status()
    ).toBe(404);
    expect((await page.request.post(endpoint, { data: { photoMode: 'other' } })).status()).toBe(
      400
    );
    await db.update(cards).set({ status: 'processing' }).where(eq(cards.id, card.id));
    const duplicates = await Promise.all(
      Array.from({ length: 4 }, () =>
        page.request.post(endpoint, { data: { photoMode: 'illustrated' } })
      )
    );
    expect(duplicates.map((response) => response.status())).toEqual([409, 409, 409, 409]);
    expect((await db.query.cards.findFirst({ where: eq(cards.id, card.id) }))?.status).toBe(
      'processing'
    );
  } finally {
    await deleteBoardsForUser(userId);
  }
});
