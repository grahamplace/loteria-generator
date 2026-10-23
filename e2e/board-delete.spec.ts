import { test, expect, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { boards } from '@/db/schema';
import { db } from './helpers/db';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('board delete', () => {
  let userId: string;

  // Each test seeds its own board count — the two cases below exercise
  // different post-delete destinations, so the starting state can't be shared.
  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  async function confirmDelete(page: Page, boardName: string) {
    // Board actions live in the header picker.
    await page.getByRole('button', { name: new RegExp(`switch board: ${boardName}`, 'i') }).click();
    await page.getByRole('menuitem', { name: 'Delete this board…', exact: true }).click();

    // AlertDialog confirm.
    await page
      .getByRole('button', { name: /^(yes,?\s*)?delete/i })
      .last()
      .click();
  }

  test('deleting the current board opens the remaining board', async ({ page }) => {
    const keep = await seedBoard({ userId, name: 'Keep Me', isUnlocked: false });
    const remove = await seedBoard({ userId, name: 'Delete Me', isUnlocked: false });
    await page.goto(`/boards/${remove.id}`);
    await expect(page.getByRole('button', { name: /switch board: Delete Me/i })).toBeVisible();

    await confirmDelete(page, 'Delete Me');

    await expect(page).toHaveURL(new RegExp(`/boards/${keep.id}$`));
    await expect(page.getByRole('button', { name: /switch board: Keep Me/i })).toBeVisible();

    const rows = await db
      .select({ name: boards.name })
      .from(boards)
      .where(eq(boards.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Keep Me');
  });

  test('deleting your only board lands you in a fresh board, not the empty state', async ({
    page,
  }) => {
    const only = await seedBoard({ userId, name: 'Last One', isUnlocked: false });

    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: 'Switch board: Last One' })).toBeVisible();

    await confirmDelete(page, 'Last One');

    // /start repairs the empty account by creating a fresh starter.
    await expect(page).not.toHaveURL(new RegExp(only.id), { timeout: 15_000 });
    await expect(page).toHaveURL(/\/boards\/[0-9a-f-]+/, { timeout: 15_000 });

    // …and it is genuinely a NEW board, not the one just deleted.
    const url = new URL(page.url());
    const newBoardId = url.pathname.split('/').pop();
    expect(newBoardId).toBeTruthy();
    expect(newBoardId).not.toBe(only.id);

    const rows = await db.select({ id: boards.id }).from(boards).where(eq(boards.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(newBoardId);
  });
});
