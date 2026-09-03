import { test, expect } from '@playwright/test';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';
import { seedCards } from './helpers/seed-cards';
import { MIN_GAME_CARD_COUNT } from '@/lib/constants';

const SEEDED_EMAIL = 'e2etest@example.com';

/**
 * Live play, across both deployables.
 *
 * The socket server runs for real (see playwright.config.ts) rather than
 * stubbed, because everything interesting lives in the handshake between it and
 * Next.js: a ticket that will not verify, a snapshot that never arrives, a Call
 * that reaches one client and not the other. A stub is precisely the half that
 * cannot fail.
 *
 * The Player runs in a second browser context with no session — that is the
 * real shape of a Game, and it is also the only way to prove the Player path
 * needs no account.
 */
test.describe('live game', () => {
  let userId: string;
  let boardId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    const board = await seedBoard({ userId, name: 'Live Play Test', isUnlocked: true });
    boardId = board.id;
    // Comfortably over the minimum, so the small-Set advisory does not change
    // what the dialog looks like.
    await seedCards({ boardId, userId, count: 20, status: 'completed' });
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('caller starts a game and a player with no account joins it', async ({ page, browser }) => {
    await page.goto(`/boards/${boardId}`);

    // The Play button is the one path a script cannot exercise — it is behind
    // auth on the Set page, which is why this test exists.
    await page.getByRole('button', { name: /play live/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^start$/i }).click();

    // Creating a Game lands the Caller on their own view, at a real Code.
    await page.waitForURL(/\/games\/\d{6}/);
    const code = page.url().match(/\/games\/(\d{6})/)![1];
    expect(code).toHaveLength(6);

    // A Player: separate context, no storage state, therefore no session.
    const playerContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const player = await playerContext.newPage();
    await player.goto(`/play/${code}`);

    // The deep link pre-fills the Code, so only a name is needed.
    await player.getByRole('textbox', { name: /your name|tu nombre/i }).fill('Ana');
    await player.getByRole('button', { name: /^join$/i }).click();

    // Sixteen markable tiles means the ticket verified, the Game rehydrated
    // from Postgres, and a snapshot came back with this Player's own Board.
    // aria-pressed is the selector because it is also the accessibility
    // contract: a tile is a toggle, and it says so.
    await expect(player.locator('button[aria-pressed]')).toHaveCount(16, { timeout: 20_000 });

    // The Caller's lobby count moves from 0 to 1 with no reload.
    //
    // This assertion is the point of the whole test, and it has to be one the
    // socket alone can satisfy. The tile count above is not: PlayerBoard falls
    // back to the join action's response when no snapshot has arrived, so it
    // renders sixteen tiles even with the socket completely dead. This number
    // only moves if a player_joined delta reached a Caller whose snapshot was
    // built before that Player existed.
    await expect(page.getByText('Waiting for players')).toBeVisible();
    await expect(page.getByText('1', { exact: true })).toBeVisible({ timeout: 20_000 });

    await playerContext.close();
  });

  test('a set with too few cards has no Play button at all', async ({ page }) => {
    // Hidden rather than disabled: a control that cannot be used should not
    // invite the click and then owe an explanation.
    await deleteBoardsForUser(userId);
    const small = await seedBoard({ userId, name: 'Too Small', isUnlocked: true });
    await seedCards({
      boardId: small.id,
      userId,
      count: MIN_GAME_CARD_COUNT - 1,
      status: 'completed',
    });

    await page.goto(`/boards/${small.id}`);
    await expect(page.getByRole('button', { name: /add photos|upload/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /play live/i })).toHaveCount(0);
  });
});
