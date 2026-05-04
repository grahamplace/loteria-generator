import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { cards } from '@/db/schema';
import { db } from './helpers/db';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';
import { seedCards } from './helpers/seed-cards';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('card edit label', () => {
  let userId: string;
  let boardId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    const board = await seedBoard({ userId, name: 'Edit Label Test', isUnlocked: true });
    boardId = board.id;
    await seedCards({ boardId, userId, count: 1 });
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('editing a card label persists across reload', async ({ page }) => {
    await page.goto(`/boards/${boardId}`);

    // Open the card by clicking on its rendered tile. Use the seeded label "Card 1".
    await page.getByText('Card 1').first().click();

    const labelInput = page.getByRole('textbox', { name: /card label/i });
    await expect(labelInput).toBeVisible({ timeout: 5_000 });
    await labelInput.fill('El Sol');

    // The label PATCH is fire-and-forget after an optimistic UI update — wait for
    // it before asserting persistence to avoid racing the in-flight request.
    const patchResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/boards/${boardId}/cards`) && res.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: /save/i }).click();
    await patchResponse;

    // Modal closes and the new label appears.
    await expect(page.getByText('El Sol')).toBeVisible({ timeout: 5_000 });

    // Persistence check via reload.
    await page.reload();
    await expect(page.getByText('El Sol')).toBeVisible({ timeout: 10_000 });

    const rows = await db
      .select({ label: cards.label })
      .from(cards)
      .where(eq(cards.boardId, boardId));
    expect(rows[0].label).toBe('El Sol');
  });
});
