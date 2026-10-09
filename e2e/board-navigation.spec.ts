import { test, expect, type Page } from '@playwright/test';

// Browser-local fixtures: no request here can read or mutate a real board.
async function editor(
  page: Page,
  { locale = 'en', count = 2, failCreate = false, failList = false } = {}
) {
  const base = 'http://localhost:3006';
  const boards = Array.from({ length: count }, (_, i) => ({
    id: `navigation-fixture-${i}`,
    name: i === 0 ? 'Our Halloween Lotería' : `Family celebration ${i}`,
    styleOptions: { presetId: i === 0 ? 'halloween' : 'birthday', showTitle: true },
    photoMode: 'original',
    isUnlocked: false,
    cards: [],
    cardCount: 0,
    completedCardCount: 0,
    previewCards: [],
  }));
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([{ name: 'better-auth.session_token', value: 'fixture-only', url: base }]);
  await page.addInitScript(() =>
    localStorage.setItem('loteria.onboarding.v1', '{"status":"skipped"}')
  );
  await page.route('**/ingest/**', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/**', (route) =>
    route.fulfill({
      json: {
        user: { id: 'fixture-user', name: 'Marisol', email: 'fixture@example.com' },
        session: { id: 'fixture-session' },
      },
    })
  );
  await page.route('**/api/boards**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/api/boards') {
      if (method === 'POST') {
        if (failCreate) {
          failCreate = false;
          return route.fulfill({ status: 500, json: { error: 'Failed' } });
        }
        const newBoard = { ...boards[0], id: 'navigation-new', name: 'My new board' };
        boards.push(newBoard);
        return route.fulfill({ json: { board: newBoard } });
      }
      if (failList) {
        failList = false;
        return route.fulfill({ status: 500, json: { error: 'Failed' } });
      }
      return route.fulfill({ json: { boards } });
    }
    const board = boards.find((item) => path === `/api/boards/${item.id}`);
    if (board) {
      if (method === 'DELETE')
        return route.fulfill({ status: 500, json: { error: 'Retry deletion' } });
      if (method === 'PATCH') Object.assign(board, route.request().postDataJSON());
      return route.fulfill({ json: { board } });
    }
    if (path.endsWith('/cards')) return route.fulfill({ json: { cards: [] } });
    return route.fulfill({ status: 404, json: { error: 'Unexpected request' } });
  });
  await page.goto(`${locale === 'es' ? '/es' : ''}/boards/navigation-fixture-0`);
  await expect(page.getByRole('button', { name: /Switch board:|Cambiar tablero:/ })).toBeVisible();
}

for (const width of [320, 390, 1440, 2560]) {
  test(`compact board picker and account menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    await editor(page);
    const trigger = page.getByRole('button', { name: /Switch board:/ });
    if (width >= 1440) {
      expect(await trigger.locator('span').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true
      );
    }
    await trigger.click();
    const current = page.getByRole('menuitem', { name: /Our Halloween/ });
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('menuitem', { name: /Family celebration 1/ })).toBeVisible();
    await expect(current).toContainText('Theme: Halloween');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({
      path: `.scratch/theme-work/board-picker-${width}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await page.getByRole('button', { name: 'Open user menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Account Settings' })).toHaveAttribute(
      'href',
      '/account'
    );
    await expect(page.getByRole('menuitem', { name: 'Sign Out' })).toBeVisible();
  });
}

test('switches boards with localized links and remembers the selected board', async ({ page }) => {
  await editor(page, { locale: 'es' });
  await page.getByRole('button', { name: /Cambiar tablero:/ }).click();
  const other = page.getByRole('menuitem', { name: /Family celebration 1/ });
  await expect(other).toHaveAttribute('href', '/es/boards/navigation-fixture-1');
  await other.click();
  await expect(
    page.getByRole('button', { name: /Cambiar tablero: Family celebration 1/ })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/es\/boards\/navigation-fixture-1$/);
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).find((cookie) => cookie.name === 'loteria-recent-board')
          ?.value
    )
    .toBe('navigation-fixture-1');
  await page.goBack();
  await expect(page.getByRole('button', { name: /Cambiar tablero: Our Halloween/ })).toBeVisible();
});

test('rename is keyboard accessible and reflected in the picker', async ({ page }) => {
  await editor(page);
  const trigger = page.getByRole('button', { name: /Switch board:/ });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Rename this board…' }).focus();
  await page.keyboard.press('Enter');
  const input = page.getByRole('textbox', { name: 'Rename board' });
  await expect(input).toBeFocused();
  await input.fill('Our family celebration');
  await input.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Switch board: Our family celebration' })
  ).toBeVisible();
  await expect(page).toHaveTitle('Our family celebration — Lotería Generator');
  await expect(
    page.getByRole('button', { name: 'Switch board: Our family celebration' })
  ).toBeFocused();
});

test('creation failure can be retried and successful creation opens the new board', async ({
  page,
}) => {
  await editor(page, { count: 1, failCreate: true });
  await page.getByRole('button', { name: /Switch board:/ }).click();
  await page.getByRole('menuitem', { name: 'New board', exact: true }).click();
  await expect(page.getByText('Couldn’t create the board. Please try again.')).toBeVisible();
  await page.getByRole('menuitem', { name: 'New board', exact: true }).click();
  await expect(page).toHaveURL(/\/boards\/navigation-new$/);
  await expect(page.getByRole('button', { name: 'Switch board: My new board' })).toBeVisible();
});

test('delete requires confirmation and failure keeps the dialog available to retry', async ({
  page,
}) => {
  await editor(page);
  await page.getByRole('button', { name: /Switch board:/ }).click();
  await page.getByRole('menuitem', { name: 'Delete this board…' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Delete board', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Couldn’t delete the board. Please try again.'
  );
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: /Switch board:/ })).toBeFocused();
});

test('large collections are paged and list failures have a retry', async ({ page }) => {
  await editor(page, { count: 55, failList: true });
  await page.getByRole('button', { name: /Switch board:/ }).click();
  await page.getByRole('menuitem', { name: 'Try again' }).click();
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
  await page.getByRole('menuitem', { name: 'More boards' }).click();
  await expect(page.getByRole('menuitem', { name: /Family celebration 20/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Our Halloween/ })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Previous boards' }).click();
  await expect(page.getByRole('menuitem', { name: /Our Halloween/ })).toBeVisible();
});
