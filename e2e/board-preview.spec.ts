import { test, expect, type Page } from '@playwright/test';
import samples from '../scripts/themes/samples/birthday.json';
import { updateBoardSchema } from '../lib/validations';

// Exercise the real editor and renderer with browser-local fixtures. No API
// request in this suite can read or mutate a user's board.
async function openEditor(page: Page, { count = 24, locale = 'en' } = {}) {
  const boardId = 'preview-layout-fixture';
  let board = {
    id: boardId,
    name: 'Our Halloween',
    isUnlocked: true,
    photoMode: 'original',
    styleOptions: { presetId: 'halloween', showTitle: true },
  };
  let cards = Array.from({ length: count }, (_, index) => {
    const card = samples.cards[index % samples.cards.length];
    return {
      id: `card-${index}`,
      number: index + 1,
      label: `${card.label} ${index + 1}`,
      illustrationUrl: card.illustration.replace(/^public/, ''),
      originalImageUrl: null,
      status: 'completed',
      isDefault: true,
    };
  });
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      { name: 'better-auth.session_token', value: 'ui-fixture-only', url: 'http://localhost:3006' },
    ]);
  await page.addInitScript(() =>
    localStorage.setItem('loteria.onboarding.v1', '{"status":"skipped"}')
  );
  await page.route('**/ingest/**', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/boards/**', async (route) => {
    const url = new URL(route.request().url());
    const data = route.request().postDataJSON();
    if (url.pathname === `/api/boards/${boardId}`) {
      if (route.request().method() === 'PATCH') {
        if (!updateBoardSchema.safeParse(data).success)
          return route.fulfill({ status: 400, json: { error: 'Invalid settings' } });
        board = { ...board, ...data };
      }
      return route.fulfill({ json: { board } });
    }
    if (url.pathname === `/api/boards/${boardId}/cards`) {
      if (route.request().method() === 'PATCH')
        cards = cards.map((card) =>
          card.id === data.cardId ? { ...card, label: data.label } : card
        );
      return route.fulfill({ json: { cards } });
    }
    return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' } });
  });
  await page.goto(`${locale === 'es' ? '/es' : ''}/boards/${boardId}`);
}

for (const width of [1024, 1440, 2560]) {
  test(`preview stays beside card editing while scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1024 ? 700 : 900 });
    await openEditor(page);
    const panel = page.getByRole('complementary', { name: 'Live preview' });
    const image = panel.getByRole('img');
    await expect(image).toBeVisible();
    await expect(panel.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByText('Export your sample', { exact: true })).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect.poll(async () => (await panel.boundingBox())!.y).toBeCloseTo(80, 0);
    const bounds = (await panel.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await expect(panel.getByRole('button', { name: 'Download set' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({
      animations: 'disabled',
      path: `.scratch/theme-work/sidebar-scrolled-${width}.png`,
    });
    if (width === 1440) {
      const mountedPanel = await panel.elementHandle();
      const before = await image.getAttribute('src');
      await page.getByText('El Abuelo 1', { exact: true }).click();
      await page.getByRole('textbox', { name: 'Card label', exact: true }).fill('El Fantasma');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect.poll(() => image.getAttribute('src')).not.toBe(before);
      expect(await mountedPanel!.evaluate((element) => element.isConnected)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        animations: 'disabled',
        path: '.scratch/theme-work/sidebar-desktop.png',
      });
    }
  });
}

test('mobile preview traps focus, returns to editing, and downloads the sample', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page, { count: 4 });
  const trigger = page.getByRole('button', { name: 'Preview & download', exact: true });
  await expect(trigger).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(trigger).toBeInViewport();
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/sidebar-mobile-editor.png',
  });
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Live preview', exact: true });
  await expect(sheet.getByRole('img')).toBeVisible();
  await expect(sheet.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await expect(sheet.getByRole('button', { name: 'Download preview' })).toBeInViewport();
  await page.keyboard.press('Shift+Tab');
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/sidebar-mobile-preview.png',
  });
  const downloaded = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Download preview' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('our-halloween-sample.pdf');
  await file.saveAs('.scratch/theme-work/sidebar-sample.pdf');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add photos', exact: true }).click();
  expect((await chooser).isMultiple()).toBe(true);
});

test('Spanish small-screen empty state and sheet close are accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, { count: 0, locale: 'es' });
  const trigger = page.getByRole('button', { name: 'Ver y descargar', exact: true });
  await trigger.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('img')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Descargar muestra' })).toBeDisabled();
  await expect(sheet.getByRole('button', { name: 'Descargar muestra' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/sidebar-mobile-es.png',
  });
  await sheet.getByRole('button', { name: 'Cerrar vista previa' }).click();
  await expect(trigger).toBeFocused();
});

test('board count survives the mobile sheet and a switch back to desktop', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await openEditor(page, { count: 16 });
  const trigger = page.getByRole('button', { name: 'Preview & download', exact: true });
  await trigger.click();
  await page.getByRole('dialog').getByRole('spinbutton').fill('2');
  await page.keyboard.press('Escape');
  await trigger.click();
  await expect(page.getByRole('dialog').getByRole('spinbutton')).toHaveValue('2');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const panel = page.getByRole('complementary', { name: 'Live preview' });
  await expect(panel.getByRole('spinbutton')).toHaveValue('2');
  const downloaded = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download set' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('our-halloween-loteria-set.pdf');
  await file.saveAs('.scratch/theme-work/sidebar-full-set.pdf');
});

test('all preview pages survive refresh, Back, and switching between desktop and mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page, { count: 54 });
  const panel = page.getByRole('complementary', { name: 'Live preview' });
  await expect(panel.getByText('Page 1 of 4', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Previous preview page' })).toBeDisabled();
  for (let current = 2; current <= 4; current++) {
    const previousImage = await panel.getByRole('img').getAttribute('src');
    const next = panel.getByRole('button', { name: 'Next preview page' });
    await next.focus();
    await next.press('Enter');
    await expect(panel.getByText(`Page ${current} of 4`, { exact: true })).toBeVisible();
    await expect.poll(() => panel.getByRole('img').getAttribute('src')).not.toBe(previousImage);
    await expect(panel.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  }
  await expect(panel.getByText('Cards 49–54', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Next preview page' })).toBeDisabled();
  await expect(
    panel.getByText('Example. Export to generate shuffled boards.', { exact: true })
  ).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Download set' })).toBeVisible();
  await panel.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/pagination-last-page.png',
  });
  await expect(page).toHaveURL(/previewPage=4$/);
  await page.goBack();
  await expect(panel.getByText('Cards 33–48', { exact: true })).toBeVisible();
  await page.goForward();
  await expect(panel.getByText('Cards 49–54', { exact: true })).toBeVisible();
  await page.reload();
  await expect(panel.getByText('Page 4 of 4', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Preview & download', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Live preview', exact: true });
  await expect(sheet.getByRole('navigation', { name: 'Preview pages' })).toBeInViewport({
    ratio: 1,
  });
  await sheet.getByRole('button', { name: 'Previous preview page' }).click();
  await expect(sheet.getByText('Cards 33–48', { exact: true })).toBeVisible();
  await expect(sheet.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/pagination-mobile.png',
  });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(panel.getByText('Page 3 of 4', { exact: true })).toBeVisible();
});

test('Spanish mobile pagination stays accessible and clamps an out-of-range link', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, { count: 54, locale: 'es' });
  await page.goto(`${page.url()}?previewPage=99&source=preview-check`);
  await expect(page).toHaveURL(/previewPage=4&source=preview-check$/);
  await page.getByRole('button', { name: 'Ver y descargar', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Cartas 49–54', { exact: true })).toBeVisible();
  const navigation = sheet.getByRole('navigation', { name: 'Páginas de la vista previa' });
  await expect(navigation).toBeInViewport({ ratio: 1 });
  await navigation.getByRole('button', { name: 'Página anterior de la vista previa' }).click();
  await expect(sheet.getByText('Página 3 de 4', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/previewPage=3&source=preview-check$/);
  await expect(sheet.getByRole('button', { name: 'Descargar juego' })).toBeInViewport({ ratio: 1 });
  await expect(sheet.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/pagination-mobile-es.png',
  });
});

test('mobile theme picker keeps the editor compact and saves a choice before closing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  const trigger = page.getByRole('button', { name: 'Change theme, currently Halloween' });
  await expect(trigger).toBeInViewport();
  expect((await trigger.boundingBox())!.height).toBeLessThanOrEqual(80);
  await expect(page.getByRole('combobox', { name: 'New photo uploads' })).toBeInViewport();
  await expect(page.getByRole('radiogroup', { name: 'Choose a theme' })).toHaveCount(0);
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/theme-picker-mobile.png',
  });

  await trigger.focus();
  await trigger.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Choose a theme' });
  await expect(sheet.getByRole('button', { name: 'Halloween', exact: true })).toBeFocused();
  await expect(sheet.getByRole('button', { name: 'Halloween', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/theme-picker-open.png',
  });
  const saved = page.waitForRequest((request) => request.method() === 'PATCH');
  await sheet.getByRole('button', { name: 'Wedding', exact: true }).click();
  expect((await saved).postDataJSON()).toEqual({
    styleOptions: expect.objectContaining({
      presetId: 'wedding',
      showTitle: true,
      backgroundColor: '#f5efdf',
      font: 'Jost',
      borderStyle: 'floral',
    }),
  });
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Change theme, currently Wedding' })).toBeFocused();
  await expect(page).not.toHaveURL(/themePicker/);
  await expect(page.getByRole('combobox', { name: 'New photo uploads' })).toHaveValue('original');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Change theme, currently Wedding' })).toBeVisible();
});

test('theme picker keeps failed saves open and lets the user retry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  await expect(
    page.getByRole('button', { name: 'Change theme, currently Halloween' })
  ).toBeVisible();
  let finishSave!: () => void;
  const delayed = new Promise<void>((resolve) => {
    finishSave = resolve;
  });
  await page.route(
    '**/api/boards/preview-layout-fixture',
    async (route) => {
      await delayed;
      await route.fulfill({ status: 500, json: { error: 'Could not save' } });
    },
    { times: 1 }
  );
  await page.getByRole('button', { name: 'Change theme, currently Halloween' }).click();
  const sheet = page.getByRole('dialog', { name: 'Choose a theme' });
  await sheet.getByRole('button', { name: 'Wedding', exact: true }).click();
  await expect(sheet.getByRole('status')).toHaveText('Saving…');
  await expect(sheet.getByRole('button', { name: 'Wedding', exact: true })).toBeDisabled();
  finishSave();
  await expect(sheet.getByRole('alert')).toHaveText('Could not save. Please try again.');
  await expect(sheet.getByRole('button', { name: 'Halloween', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await sheet.getByRole('button', { name: 'Wedding', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Change theme, currently Wedding' })).toBeFocused();
});

test('Spanish theme picker fits a small phone and supports Back, refresh, and desktop resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, { locale: 'es' });
  await page.goto(`${page.url()}?previewPage=2&source=theme-check`);
  const trigger = page.getByRole('button', { name: 'Cambiar tema, actual: Halloween' });
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Elige un tema' });
  await expect(sheet).toBeVisible();
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.goForward();
  await expect(sheet).toBeVisible();
  await page.reload();
  await expect(sheet.getByRole('button', { name: 'Halloween', exact: true })).toBeFocused();
  const lastTheme = sheet.getByRole('button', { name: 'Pascua', exact: true });
  await lastTheme.focus();
  await expect(lastTheme).toBeInViewport();
  await expect(sheet.getByRole('button', { name: 'Cerrar selector de temas' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/theme-picker-small-es.png',
  });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/previewPage=2&source=theme-check$/);
  await trigger.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Halloween', exact: true })).toBeChecked();
  await expect(page).toHaveURL(/previewPage=2&source=theme-check$/);
});

test('custom designs update the preview, persist, export, and reset to a preset', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page, { count: 4 });
  const panel = page.getByRole('complementary', { name: 'Live preview' });
  await expect(panel.getByRole('img')).toBeVisible();
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  const background = page.getByRole('textbox', { name: 'Background', exact: true });
  await expect(background).toHaveValue('#21152e');
  await expect(page.getByRole('combobox', { name: 'Font', exact: true })).toHaveValue('Creepster');
  await expect(page.getByRole('combobox', { name: 'Border style', exact: true })).toHaveValue(
    'web'
  );
  const before = await panel.getByRole('img').getAttribute('src');
  await background.fill('#123456');
  const saved = page.waitForRequest((request) => request.method() === 'PATCH');
  await background.press('Enter');
  expect((await saved).postDataJSON()).toEqual({
    styleOptions: {
      presetId: 'custom',
      showTitle: true,
      backgroundColor: '#123456',
      badgeColor: '#bc441f',
      numberColor: '#ffffff',
      labelColor: '#ffe8af',
      borderColor: '#d9a952',
      font: 'Creepster',
      borderStyle: 'web',
    },
  });
  await expect(page.getByRole('radio', { name: 'Custom', exact: true })).toBeChecked();
  await expect.poll(() => panel.getByRole('img').getAttribute('src')).not.toBe(before);
  await page.getByLabel('Choose Number background color', { exact: true }).fill('#554433');
  await expect(page.getByRole('textbox', { name: 'Number background', exact: true })).toBeEnabled();
  await page.getByRole('textbox', { name: 'Number text', exact: true }).fill('#ffffaa');
  await page.getByRole('textbox', { name: 'Number text', exact: true }).press('Enter');
  await page.getByRole('combobox', { name: 'Font', exact: true }).selectOption('Bebas Neue');
  await page.getByRole('combobox', { name: 'Border style', exact: true }).selectOption('double');
  await page.getByRole('textbox', { name: 'Border color', exact: true }).fill('#c0ffee');
  await page.getByRole('textbox', { name: 'Border color', exact: true }).press('Enter');
  await expect(page.getByRole('combobox', { name: 'Font', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Custom', exact: true })).toBeChecked();
  await expect(background).toHaveValue('#123456');
  await expect(page.getByRole('textbox', { name: 'Number background', exact: true })).toHaveValue(
    '#554433'
  );
  await expect(page.getByRole('textbox', { name: 'Number text', exact: true })).toHaveValue(
    '#ffffaa'
  );
  await expect(page.getByRole('textbox', { name: 'Border color', exact: true })).toHaveValue(
    '#c0ffee'
  );
  await expect(page.getByRole('combobox', { name: 'Font', exact: true })).toHaveValue('Bebas Neue');
  await expect(page.getByRole('combobox', { name: 'Border style', exact: true })).toHaveValue(
    'double'
  );
  await expect(panel.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/custom-design-desktop.png',
  });
  const downloaded = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download preview' }).click();
  await (await downloaded).saveAs('.scratch/theme-work/custom-design.pdf');
  await page.getByRole('radio', { name: 'Wedding', exact: true }).focus();
  await page.getByRole('radio', { name: 'Wedding', exact: true }).press('Space');
  await expect(background).toHaveValue('#f5efdf');
  await expect(page.getByRole('textbox', { name: 'Number background', exact: true })).toHaveValue(
    '#7b946c'
  );
  await expect(page.getByRole('combobox', { name: 'Font', exact: true })).toHaveValue('Jost');
  await expect(page.getByRole('combobox', { name: 'Border style', exact: true })).toHaveValue(
    'floral'
  );
  await expect(page.getByRole('checkbox', { name: 'Include board title' })).toBeChecked();
});

test('mobile custom controls are compact, validate colors, and preserve the saved design on failure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, { locale: 'es' });
  const customize = page.getByRole('button', { name: 'Personalizar', exact: true });
  await expect(customize).toHaveAttribute('aria-expanded', 'false');
  await customize.click();
  const background = page.getByRole('textbox', { name: 'Fondo', exact: true });
  await background.fill('oops');
  await background.press('Enter');
  await expect(background).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Ingresa un color hexadecimal de 6 dígitos.')).toBeVisible();
  await page.route(
    '**/api/boards/preview-layout-fixture',
    (route) => route.fulfill({ status: 500, json: { error: 'failed' } }),
    { times: 1 }
  );
  await background.fill('123456');
  await background.press('Enter');
  await expect(page.getByText('No se pudo guardar. Inténtalo de nuevo.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cambiar tema, actual: Halloween' })).toBeVisible();
  await background.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Cambiar tema, actual: Personalizado' })
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByText('Failed to update board', { exact: true })).toBeHidden({
    timeout: 10000,
  });
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/custom-design-mobile-es.png',
  });
  await page.reload();
  await expect(background).toHaveValue('#123456');
  await customize.click();
  await expect(background).toBeHidden();
  await page.goBack();
  await expect(background).toBeVisible();
});
