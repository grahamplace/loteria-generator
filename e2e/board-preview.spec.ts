import { test, expect, type Page, type Locator } from '@playwright/test';
import samples from '../scripts/themes/samples/birthday.json';
import { updateBoardSchema } from '../lib/validations';
import { mergeBoardStyles, type BoardStyleOptions } from '../lib/themes/presets';
import { E2E_BASE_URL } from './helpers/base-url';

// Exercise the real editor and renderer with browser-local fixtures. No API
// request in this suite can read or mutate a user's board.
async function openEditor(page: Page, { count = 24, locale = 'en', name = 'Our Halloween' } = {}) {
  const boardId = 'preview-layout-fixture';
  const initialStyles: BoardStyleOptions = { presetId: 'halloween', showTitle: true };
  let board = {
    id: boardId,
    name,
    isUnlocked: true,
    photoMode: 'original',
    styleOptions: initialStyles,
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
      { name: 'better-auth.session_token', value: 'ui-fixture-only', url: E2E_BASE_URL },
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
        board = {
          ...board,
          ...data,
          styleOptions: data.styleOptions
            ? mergeBoardStyles(board.styleOptions, data.styleOptions)
            : board.styleOptions,
        };
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

// Direct hex entry is secondary: dismiss the focus-opened native chooser first.
async function enterHex(page: Page, field: Locator, value: string) {
  await field.focus();
  await page.keyboard.press('Escape');
  await field.fill(value);
  await field.press('Enter');
}

const designCopy = {
  en: {
    change: /^Change theme, currently /,
    preview: 'Preview & download',
    title: 'Design your set',
    customize: 'Customize colors & font',
  },
  es: {
    change: /^Cambiar tema, actual: /,
    preview: 'Ver y descargar',
    title: 'Diseña tu juego',
    customize: 'Personalizar colores y tipografía',
  },
};

// Open "Design your set" the way a user does at this width: the sidebar's
// Theme row on desktop, the Theme row inside the preview sheet on phones.
async function openDesign(page: Page, locale: 'en' | 'es' = 'en') {
  const copy = designCopy[locale];
  if (page.viewportSize()!.width < 1024)
    await page.getByRole('button', { name: copy.preview, exact: true }).click();
  await page.getByRole('button', { name: copy.change }).click();
  const design = page.getByRole('dialog', { name: copy.title, exact: true });
  await expect(design).toBeVisible();
  return design;
}

async function openCustomize(design: Locator, locale: 'en' | 'es' = 'en') {
  const toggle = design.getByRole('button', { name: designCopy[locale].customize, exact: true });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

test('desktop design opens from the Theme row beside the preview and follows history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page, { count: 20 });
  // Nothing design-related sits above the cards any more.
  await expect(page.getByRole('region', { name: 'Design your set' })).toHaveCount(0);
  const uploads = page.getByRole('region', { name: 'Drop photos to add cards' });
  expect((await uploads.boundingBox())!.y).toBeLessThan(200);
  const panel = page.getByRole('complementary', { name: 'Live preview' });
  const change = panel.getByRole('button', { name: 'Change theme, currently Halloween' });
  await expect(change).toHaveText('Change…');
  // Theme sits between the page navigation and the download controls.
  const navigation = (await panel
    .getByRole('navigation', { name: 'Preview pages' })
    .boundingBox())!;
  const row = (await change.boundingBox())!;
  const download = (await panel.getByRole('button', { name: 'Download set' }).boundingBox())!;
  expect(navigation.y).toBeLessThan(row.y);
  expect(row.y).toBeLessThan(download.y);

  await change.click();
  await expect(page).toHaveURL(/design=1/);
  const dialog = page.getByRole('dialog', { name: 'Design your set', exact: true });
  await expect(dialog.getByRole('button', { name: 'Halloween', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(dialog.getByRole('button', { name: 'Customize colors & font' })).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await page.goForward();
  await expect(dialog).toBeVisible();
  await page.reload();
  await expect(dialog).toBeVisible();
  const image = dialog.getByRole('img');
  await expect(dialog.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/design-dialog-desktop.png',
  });
  const before = await image.getAttribute('src');
  const saved = page.waitForRequest((request) => request.method() === 'PATCH');
  await dialog.getByRole('button', { name: 'Wedding', exact: true }).click();
  expect((await saved).postDataJSON()).toEqual({
    styleOptions: expect.objectContaining({
      presetId: 'wedding',
      showTitle: true,
      backgroundColor: '#f5efdf',
      font: 'Jost',
      borderStyle: 'double',
    }),
  });
  await expect(dialog.getByRole('button', { name: 'Wedding', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect.poll(() => image.getAttribute('src')).not.toBe(before);
  await expect(dialog.getByRole('status').first()).toHaveText('Saved');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/design=1/);
  await expect(
    panel.getByRole('button', { name: 'Change theme, currently Wedding' })
  ).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Spanish phone sheet swaps to the design view, saves a theme, and deep-links', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page, { count: 20, locale: 'es' });
  await expect(page.getByRole('region', { name: 'Diseña tu juego' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver y descargar', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Vista previa en vivo', exact: true });
  const row = sheet.getByRole('button', { name: 'Cambiar tema, actual: Halloween' });
  await expect(row).toBeInViewport();
  expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/design-row-mobile-es.png',
  });
  await row.click();
  const design = page.getByRole('dialog', { name: 'Diseña tu juego', exact: true });
  await expect(design.getByRole('button', { name: 'Volver a la vista previa' })).toBeFocused();
  await expect(page).toHaveURL(/design=1/);
  const wedding = design.getByRole('button', { name: 'Boda', exact: true });
  expect((await wedding.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await expect(design.getByRole('button', { name: 'Listo', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await expect(design.getByText('Tus cartas siguen iguales. Solo cambia la tabla.')).toBeVisible();
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/design-view-mobile-es.png',
  });
  const saved = page.waitForRequest((request) => request.method() === 'PATCH');
  await wedding.click();
  expect((await saved).postDataJSON()).toEqual({
    styleOptions: expect.objectContaining({ presetId: 'wedding' }),
  });
  await expect(wedding).toHaveAttribute('aria-pressed', 'true');
  await expect(design.getByRole('status')).toHaveText('Guardado');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // One link opens the design view at every width.
  await page.reload();
  await expect(design).toBeVisible();
  await expect(wedding).toHaveAttribute('aria-pressed', 'true');
  await design.getByRole('button', { name: 'Listo', exact: true }).click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Cambiar tema, actual: Boda' })).toBeFocused();
  await expect(page).not.toHaveURL(/design=1/);
  await expect(sheet.getByRole('button', { name: 'Descargar juego' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

for (const [locale, width] of [
  ['en', 1440],
  ['es', 390],
] as const) {
  test(`upload-area photo mode stays in sync, waits for saving, and recovers (${locale})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openEditor(page, { count: 2, locale });
    const uploads = page.getByRole('region', {
      name: locale === 'en' ? 'Drop photos to add cards' : 'Suelta fotos para agregar cartas',
    });
    const illustrated = uploads.getByRole('switch', {
      name: locale === 'en' ? 'Illustrate my photos' : 'Ilustrar mis fotos',
    });
    // Photo mode has one home now: the upload area.
    await expect(
      page.getByRole('switch', {
        name: locale === 'en' ? 'Illustrate my photos' : 'Ilustrar mis fotos',
      })
    ).toHaveCount(1);
    const choosePhotos = uploads.getByRole('button', {
      name: locale === 'en' ? 'Choose photos' : 'Seleccionar fotos',
    });
    async function expectKnobAtEdge(control: Locator, on: boolean) {
      await expect
        .poll(async () =>
          control.evaluate((el, checked) => {
            const track = el.getBoundingClientRect();
            const thumb = el.querySelector('[data-slot="switch-thumb"]')!.getBoundingClientRect();
            return Math.round(checked ? track.right - thumb.right : thumb.left - track.left);
          }, on)
        )
        .toBe(3);
    }
    await expect(illustrated).not.toBeChecked();
    await expectKnobAtEdge(illustrated, false);
    let release!: () => void;
    let fail = false;
    let delayed = true;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/boards/preview-layout-fixture', async (route) => {
      if (route.request().method() === 'PATCH') {
        if (delayed) await gate;
        if (fail) return route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
      }
      return route.fallback();
    });
    try {
      await uploads
        .getByText(locale === 'en' ? 'Illustrate my photos' : 'Ilustrar mis fotos', { exact: true })
        .click();
      await expect(illustrated).toBeChecked();
      await expect(choosePhotos).toBeDisabled();
    } finally {
      delayed = false;
      release();
    }
    await expect(choosePhotos).toBeEnabled();
    await page.reload();
    await expect(illustrated).toBeChecked();
    await illustrated.click();
    await expect(illustrated).not.toBeChecked();
    await expect(illustrated).toBeEnabled();
    fail = true;
    await illustrated.click();
    await expect(illustrated).toBeEnabled();
    await expect(illustrated).not.toBeChecked();
    fail = false;
    await illustrated.focus();
    await page.keyboard.press('Space');
    await expect(illustrated).toBeChecked();
    await expect(illustrated).toBeEnabled();
    await expectKnobAtEdge(illustrated, true);
    await uploads.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    expect(await uploads.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await uploads.screenshot({ path: `.scratch/theme-work/upload-photo-mode-${locale}.png` });
    if (locale === 'en') {
      await page.setViewportSize({ width: 2800, height: 1200 });
      await expect(illustrated).toBeVisible();
      expect(await uploads.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  });
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

test('design view keeps failed theme saves on screen and lets the user retry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  let finishSave!: () => void;
  const delayed = new Promise<void>((resolve) => {
    finishSave = resolve;
  });
  let failures = 1;
  await page.route('**/api/boards/preview-layout-fixture', async (route) => {
    if (route.request().method() !== 'PATCH' || failures === 0) return route.fallback();
    failures -= 1;
    await delayed;
    await route.fulfill({ status: 500, json: { error: 'Could not save' } });
  });
  const design = await openDesign(page);
  await design.getByRole('button', { name: 'Wedding', exact: true }).click();
  await expect(design.getByRole('status')).toHaveText('Saving…');
  await expect(design.getByRole('button', { name: 'Wedding', exact: true })).toBeDisabled();
  finishSave();
  await expect(design.getByRole('alert')).toHaveText('Could not save. Please try again.');
  await expect(design.getByRole('button', { name: 'Halloween', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await design.getByRole('button', { name: 'Wedding', exact: true }).click();
  await expect(design.getByRole('button', { name: 'Wedding', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(design.getByRole('status')).toHaveText('Saved');
});

test('Spanish design view fits a small phone and follows Back, refresh, and desktop resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, { locale: 'es' });
  await page.goto(`${page.url()}?previewPage=2&source=theme-check`);
  const design = await openDesign(page, 'es');
  const sheet = page.getByRole('dialog', { name: 'Vista previa en vivo', exact: true });
  await page.goBack();
  await expect(design).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await page.goForward();
  await expect(design).toBeVisible();
  await page.reload();
  await expect(design).toBeVisible();
  const lastTheme = design.getByRole('button', { name: 'Pascua', exact: true });
  await lastTheme.focus();
  await expect(lastTheme).toBeInViewport();
  await expect(design.getByRole('button', { name: 'Listo', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await expect(design.getByRole('button', { name: 'Volver a la vista previa' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/design-view-small-es.png',
  });
  // The same link becomes the desktop dialog when the screen grows.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(design.getByRole('button', { name: 'Halloween', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page).toHaveURL(/previewPage=2&source=theme-check&design=1$/);
  await page.keyboard.press('Escape');
  await expect(design).toHaveCount(0);
  await expect(page).toHaveURL(/previewPage=2&source=theme-check$/);
});

test('custom designs update the preview, persist, export, and reset to a preset', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page, { count: 4 });
  const panel = page.getByRole('complementary', { name: 'Live preview' });
  await expect(panel.getByRole('img')).toBeVisible();
  let design = await openDesign(page);
  await openCustomize(design);
  const background = design.getByRole('textbox', { name: 'Background', exact: true });
  await expect(background).toHaveValue('#21152e');
  await expect(design.getByRole('combobox', { name: 'Font', exact: true })).toHaveAttribute(
    'data-value',
    'Creepster'
  );
  await expect(design.getByRole('radio', { name: 'Double', exact: true })).toBeChecked();
  await expect(design.getByRole('combobox', { name: 'Corner icons', exact: true })).toHaveAttribute(
    'data-value',
    'cobweb'
  );
  const image = design.getByRole('img');
  const before = await image.getAttribute('src');
  const saved = page.waitForRequest((request) => request.method() === 'PATCH');
  await enterHex(page, background, '#123456');
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
      borderStyle: 'double',
      cornerIcon: 'cobweb',
    },
  });
  await expect(design.getByRole('button', { name: 'Custom', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect.poll(() => image.getAttribute('src')).not.toBe(before);
  await page.getByLabel('Choose Number background color', { exact: true }).fill('#554433');
  await expect(
    design.getByRole('textbox', { name: 'Number background', exact: true })
  ).toBeEnabled();
  await enterHex(
    page,
    design.getByRole('textbox', { name: 'Number text', exact: true }),
    '#ffffaa'
  );
  await design.getByRole('combobox', { name: 'Font', exact: true }).click();
  await page.getByRole('option', { name: 'Bebas Neue', exact: true }).click();
  await design.getByRole('radio', { name: 'Dashed', exact: true }).check();
  await design.getByRole('combobox', { name: 'Corner icons', exact: true }).click();
  await page.getByRole('option', { name: 'Hearts', exact: true }).click();
  // Reloading while this save is in flight would cancel it.
  const borderColorSaved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.request().postData()?.includes('#c0ffee') === true
  );
  await enterHex(
    page,
    design.getByRole('textbox', { name: 'Border color', exact: true }),
    '#c0ffee'
  );
  expect((await borderColorSaved).ok()).toBe(true);
  await expect(design.getByRole('combobox', { name: 'Font', exact: true })).toBeEnabled();
  // ?design=1 survives the reload with the custom design in Customize.
  await page.reload();
  await expect(design.getByRole('button', { name: 'Custom', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(background).toHaveValue('#123456');
  await expect(design.getByRole('textbox', { name: 'Number background', exact: true })).toHaveValue(
    '#554433'
  );
  await expect(design.getByRole('textbox', { name: 'Number text', exact: true })).toHaveValue(
    '#ffffaa'
  );
  await expect(design.getByRole('textbox', { name: 'Border color', exact: true })).toHaveValue(
    '#c0ffee'
  );
  await expect(design.getByRole('combobox', { name: 'Font', exact: true })).toHaveAttribute(
    'data-value',
    'Bebas Neue'
  );
  await expect(design.getByRole('radio', { name: 'Dashed', exact: true })).toBeChecked();
  await expect(design.getByRole('combobox', { name: 'Corner icons', exact: true })).toHaveAttribute(
    'data-value',
    'heart'
  );
  await expect(design.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/custom-design-desktop.png',
  });
  await design.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(design).toHaveCount(0);
  await expect(panel.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  const downloaded = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download preview' }).click();
  await (await downloaded).saveAs('.scratch/theme-work/custom-design.pdf');
  design = await openDesign(page);
  await design.getByRole('button', { name: 'Wedding', exact: true }).click();
  await expect(background).toHaveValue('#f5efdf');
  await expect(design.getByRole('textbox', { name: 'Number background', exact: true })).toHaveValue(
    '#b38d4d'
  );
  await expect(design.getByRole('combobox', { name: 'Font', exact: true })).toHaveAttribute(
    'data-value',
    'Jost'
  );
  await expect(design.getByRole('radio', { name: 'Double', exact: true })).toBeChecked();
  await expect(
    design.getByRole('checkbox', { name: /Print the board name at the top/ })
  ).toBeChecked();
});

test('mobile custom controls are compact, validate colors, and preserve the saved design on failure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, { locale: 'es' });
  const design = await openDesign(page, 'es');
  const customize = design.getByRole('button', {
    name: 'Personalizar colores y tipografía',
    exact: true,
  });
  await expect(customize).toHaveAttribute('aria-expanded', 'true');
  const background = design.getByRole('textbox', { name: 'Fondo', exact: true });
  // Rows are phone-sized and the hex field is large enough that iOS will not zoom.
  const swatch = design.getByLabel('Elegir color: Fondo', { exact: true });
  expect((await swatch.locator('..').boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await expect(background).toHaveCSS('font-size', '16px');
  await enterHex(page, background, 'oops');
  await expect(background).toHaveAttribute('aria-invalid', 'true');
  await expect(design.getByText('Ingresa un color hexadecimal de 6 dígitos.')).toBeVisible();
  await page.route(
    '**/api/boards/preview-layout-fixture',
    (route) => route.fulfill({ status: 500, json: { error: 'failed' } }),
    { times: 1 }
  );
  await enterHex(page, background, '123456');
  // The same message also appears as a toast; check the inline alert.
  await expect(design.getByRole('alert')).toHaveText('No se pudo guardar. Inténtalo de nuevo.');
  await expect(design.getByRole('button', { name: 'Halloween', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await enterHex(page, background, '123456');
  await expect(design.getByRole('button', { name: 'Personalizado', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
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
});

for (const width of [1440, 390]) {
  test(`last custom design survives preset changes and refresh at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openEditor(page, { count: 4 });
    const design = await openDesign(page);
    await openCustomize(design);
    const background = design.getByRole('textbox', { name: 'Background', exact: true });
    await enterHex(page, background, '#345678');
    await design.getByRole('combobox', { name: 'Font', exact: true }).click();
    await page.getByRole('option', { name: 'Caveat', exact: true }).click();
    await design.getByRole('radio', { name: 'Dashed', exact: true }).check();
    await expect(background).toBeEnabled();
    async function choose(name: string) {
      const choice = design.getByRole('button', { name, exact: true });
      await expect(choice).toBeEnabled();
      await choice.click();
      await expect(choice).toHaveAttribute('aria-pressed', 'true');
    }
    await choose('Wedding');
    await expect(background).toHaveValue('#f5efdf');
    await choose('Christmas');
    await expect(background).toHaveValue('#103b30');
    await page.reload();
    await choose('Custom');
    await expect(background).toHaveValue('#345678');
    await expect(design.getByRole('combobox', { name: 'Font', exact: true })).toHaveAttribute(
      'data-value',
      'Caveat'
    );
    await expect(design.getByRole('radio', { name: 'Dashed', exact: true })).toBeChecked();
    await enterHex(page, background, '#abcdef');
    await expect(background).toBeEnabled();
    await choose('Classic');
    await page.reload();
    await choose('Custom');
    await expect(background).toHaveValue('#abcdef');
    await expect(design.getByRole('combobox', { name: 'Font', exact: true })).toHaveAttribute(
      'data-value',
      'Caveat'
    );
    await expect(design.getByRole('radio', { name: 'Dashed', exact: true })).toBeChecked();
    await page.reload();
    await expect(background).toHaveValue('#abcdef');
  });
}

for (const width of [1024, 1440, 2560]) {
  test(`expanded preview shows sharp detail, zooms, and returns focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openEditor(page, { count: 54 });
    const panel = page.getByRole('complementary', { name: 'Live preview' });
    const expand = panel.getByRole('button', { name: 'Full Screen preview' });
    await expect(expand).toBeVisible();
    const smallWidth = (await panel.getByRole('img').boundingBox())!.width;
    await expand.focus();
    await expand.press('Enter');
    const viewer = page.getByRole('dialog', { name: 'Board preview', exact: true });
    const image = viewer.getByRole('img');
    const region = viewer.getByRole('region');
    await expect(viewer).toBeVisible();
    await expect(region).toHaveAttribute('aria-busy', 'false');
    await expect
      .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(2550);
    const fitWidth = (await image.boundingBox())!.width;
    expect(fitWidth).toBeGreaterThan(smallWidth);
    expect((await viewer.boundingBox())!.width).toBe(width);
    expect((await viewer.boundingBox())!.height).toBe(900);
    await expect(viewer.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    await page.keyboard.press('Tab');
    expect(await viewer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    const source = await image.getAttribute('src');
    for (const zoom of [150, 200, 300, 400]) {
      await viewer.getByRole('button', { name: 'Zoom in' }).click();
      await expect(viewer.getByText(`${zoom}%`, { exact: true })).toBeVisible();
    }
    await expect(viewer.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect((await image.boundingBox())!.width).toBeCloseTo(fitWidth * 4, 0);
    await expect(image).toHaveAttribute('src', source!);
    const overflow = await region.evaluate((el) => ({
      x: el.scrollWidth > el.clientWidth,
      y: el.scrollHeight > el.clientHeight,
    }));
    expect(overflow).toEqual({ x: fitWidth * 4 + 32 > width, y: true });
    await region.evaluate((el) => {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    });
    await page.screenshot({
      animations: 'disabled',
      path: `.scratch/theme-work/preview-zoom-${width}.png`,
    });
    await viewer.getByRole('button', { name: 'Fit board to screen' }).click();
    await expect(viewer.getByText('100%', { exact: true })).toBeVisible();
    await viewer.getByRole('button', { name: 'Next preview page' }).click();
    await expect(viewer.getByText('Cards 17–32', { exact: true })).toBeVisible();
    await expect.poll(() => image.getAttribute('src')).not.toBe(source);
    await expect(region).toHaveAttribute('aria-busy', 'false');
    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);
    await expect(expand).toBeFocused();
    await expect(panel.getByText('Page 2 of 4', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  });
}

test('Spanish mobile expanded preview layers over the sheet and survives refresh and Back', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, { count: 20, locale: 'es' });
  const open = page.getByRole('button', { name: 'Ver y descargar', exact: true });
  await open.click();
  const sheet = page.getByRole('dialog', { name: 'Vista previa en vivo', exact: true });
  const expand = sheet.getByRole('button', { name: 'Vista previa en pantalla completa' });
  await expand.click();
  const viewer = page.getByRole('dialog', { name: 'Vista previa ampliada', exact: true });
  await expect(viewer).toBeVisible();
  const region = viewer.getByRole('region');
  await expect(region).toHaveAttribute('aria-busy', 'false');
  for (const name of [
    'Acercar',
    'Alejar',
    'Ajustar tabla a la pantalla',
    'Cerrar vista previa ampliada',
  ]) {
    await expect(viewer.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
  }
  await viewer.getByRole('button', { name: 'Acercar', exact: true }).click();
  await viewer.getByRole('button', { name: 'Acercar', exact: true }).click();
  expect((await viewer.getByRole('img').boundingBox())!.width).toBeGreaterThan(320);
  await region.focus();
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(viewer.getByRole('navigation')).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/preview-zoom-mobile-es.png',
  });
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(expand).toBeFocused();
  await expand.click();
  await page.goBack();
  await expect(viewer).toHaveCount(0);
  await page.goForward();
  await expect(viewer).toBeVisible();
  await viewer.getByRole('button', { name: 'Acercar', exact: true }).click();
  await page.reload();
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText('150%', { exact: true })).toBeVisible();
  await viewer.getByRole('button', { name: 'Cerrar vista previa ampliada', exact: true }).click();
  await expect(open).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('expanded preview stays usable on a slower device and connection', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page, { count: 16 });
  await page.getByRole('button', { name: 'Preview & download', exact: true }).click();
  const expand = page
    .getByRole('dialog', { name: 'Live preview', exact: true })
    .getByRole('button', { name: 'Full Screen preview' });
  await expect(expand).toBeVisible();
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200000,
    uploadThroughput: 100000,
  });
  await page.evaluate(() => performance.mark('expand-start'));
  await expand.click();
  const viewer = page.getByRole('dialog', { name: 'Board preview', exact: true });
  await expect(viewer).toBeVisible();
  const openMs = await page.evaluate(
    () => performance.now() - performance.getEntriesByName('expand-start')[0].startTime
  );
  await viewer.getByRole('button', { name: 'Zoom in' }).click();
  await expect(viewer.getByText('150%', { exact: true })).toBeVisible();
  await expect(viewer.getByRole('region')).toHaveAttribute('aria-busy', 'false', {
    timeout: 30000,
  });
  await expect
    .poll(() => viewer.getByRole('img').evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBe(2550);
  const readyMs = await page.evaluate(
    () => performance.now() - performance.getEntriesByName('expand-start')[0].startTime
  );
  await test.info().attach('expanded-preview-profile', {
    body: JSON.stringify({
      expandedPreviewProfile: {
        cpuSlowdown: 4,
        latencyMs: 150,
        downloadBytesPerSecond: 200000,
        openMs: Math.round(openMs),
        readyMs: Math.round(readyMs),
      },
    }),
    contentType: 'application/json',
  });
  await viewer.getByRole('button', { name: 'Close expanded preview' }).click();
  await expect(expand).toBeFocused();
  await session.detach();
});

test('font picker previews the actual title, loads on demand, and exports every new face', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fonts = ['Montserrat', 'Playfair Display', 'Fredoka', 'Roboto Slab'];
  const requestedFonts: string[] = [];
  page.on('request', (request) => {
    if (fonts.some((font) => request.url().includes(font.replaceAll(' ', '') + '-Regular')))
      requestedFonts.push(request.url());
  });
  await openEditor(page, { count: 4, name: 'Lucía y José · 50 años' });
  const panel = page.getByRole('complementary', { name: 'Live preview' });
  await expect(panel.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  let design = await openDesign(page);
  await openCustomize(design);
  const trigger = page.getByRole('combobox', { name: 'Font', exact: true });
  await expect(trigger).toContainText('LUCÍA Y JOSÉ · 50 AÑOS');
  expect(requestedFonts).toEqual([]);
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  for (const font of fonts) {
    const option = page.getByRole('option', { name: font, exact: true });
    await expect(option).toBeEnabled();
    await expect(option).toContainText('LUCÍA Y JOSÉ · 50 AÑOS');
    await expect(option.locator('[title]')).toHaveCSS(
      'font-family',
      `"${font}", sans-serif`.replace(/^"([A-Za-z]+)"/, '$1')
    );
  }
  expect(requestedFonts).toHaveLength(4);
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/font-picker-desktop.png',
  });
  await page.keyboard.press('m');
  await expect(page.getByRole('option', { name: 'Montserrat', exact: true })).toBeFocused();
  // Browsing options does not save until Enter commits the choice. The open
  // menu hides the trigger from role queries, so find it by its label.
  await expect(page.getByLabel('Font', { exact: true })).toHaveAttribute('data-value', 'Creepster');
  await page.keyboard.press('Enter');
  await expect(trigger).toBeFocused();
  const rendered = new Set<string | null>();
  for (const font of fonts) {
    if (font !== fonts[0]) {
      await trigger.click();
      await page.getByRole('option', { name: font, exact: true }).click();
    }
    await expect(trigger).toHaveAttribute('data-value', font);
    await expect(design.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
    rendered.add(await design.getByRole('img').getAttribute('src'));
    // Export from the sidebar, then come back to the (now custom) design.
    await design.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(design).toHaveCount(0);
    await expect(panel.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
    const download = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download preview' }).click();
    await (await download).saveAs(`.scratch/theme-work/font-${font.replaceAll(' ', '-')}.pdf`);
    design = await openDesign(page);
    await expect(trigger).toBeVisible();
  }
  expect(rendered.size).toBe(4);
  await expect(design.getByRole('button', { name: 'Custom', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.reload();
  await expect(trigger).toHaveAttribute('data-value', 'Roboto Slab');
  await expect(trigger).toContainText('LUCÍA Y JOSÉ · 50 AÑOS');
});

test('font picker fits a narrow Spanish screen and keeps long titles contained', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, {
    locale: 'es',
    name: 'La fiesta de cumpleaños de Lucía, José y toda nuestra familia',
  });
  await openCustomize(await openDesign(page, 'es'), 'es');
  const trigger = page.getByRole('combobox', { name: 'Tipografía', exact: true });
  await trigger.click();
  const menu = page.getByRole('listbox');
  await expect(page.getByRole('option', { name: 'Fredoka', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = (await menu.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(bounds.height).toBeLessThanOrEqual(568);
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/font-picker-mobile-es.png',
  });
  await page.keyboard.press('f');
  await expect(page.getByRole('option', { name: 'Fredoka', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('data-value', 'Fredoka');
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('data-value', 'Fredoka');
});

test('font loading failures can retry without saving a broken font', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/fonts/themes/Fredoka-Regular.woff2', (route) => route.abort(), { times: 1 });
  await openEditor(page);
  const design = await openDesign(page);
  await openCustomize(design);
  const trigger = page.getByRole('combobox', { name: 'Font', exact: true });
  await trigger.click();
  const option = page.getByRole('option', { name: 'Fredoka', exact: true });
  await expect(option).toContainText('Couldn’t load font preview.');
  await expect(option).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('data-value', 'Creepster');
  await design.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(option).toBeEnabled();
  await option.click();
  await expect(trigger).toHaveAttribute('data-value', 'Fredoka');
  await expect(page.getByText('Couldn’t load font preview.')).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`color fields open the visual chooser on focus without a focus border at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      const showPicker = HTMLInputElement.prototype.showPicker;
      HTMLInputElement.prototype.showPicker = function () {
        showPicker.call(this);
        this.dataset.opened = String(Number(this.dataset.opened ?? 0) + 1);
      };
    });
    await openEditor(page);
    const design = await openDesign(page);
    await openCustomize(design);
    const field = design.getByRole('textbox', { name: 'Number text', exact: true });
    const swatch = design.getByLabel('Choose Number text color', { exact: true });
    // Clicking outside closes the OS chooser. (Inside a modal, headless Chromium
    // routes Escape to the chooser instead, so this test does not rely on it.)
    const elsewhere = design.getByRole('heading', { name: 'Design your set' });
    await field.click();
    // Calls the real browser API, including its user-activation requirement.
    await expect(swatch).toHaveAttribute('data-opened', '1');
    await expect(field).toHaveCSS('outline-style', 'none');
    await expect(field.locator('..')).toHaveCSS('box-shadow', 'none');
    await elsewhere.click();
    await field.click();
    await expect(swatch).toHaveAttribute('data-opened', '2');
    await elsewhere.click();
    await swatch.click();
    await expect(swatch).toHaveAttribute('data-opened', '3');
    await elsewhere.click();
    // Leaving the field untouched keeps the preset; it does not become Custom.
    await expect(field).toHaveValue('#ffffff');
    await expect(design.getByRole('button', { name: 'Halloween', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await page.screenshot({
      animations: 'disabled',
      path: `.scratch/theme-work/color-focus-${width}.png`,
    });
  });
}

for (const width of [1024, 1440, 2560]) {
  test(`inline zoom carries into the design dialog and updates without losing the inspected spot at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openEditor(page, { count: 24 });
    const panel = page.getByRole('complementary', { name: 'Live preview' });
    const viewport = panel.getByRole('region', { name: 'Zoomable live board preview' });
    const image = panel.getByRole('img');
    await expect(panel.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
    const fittedBounds = (await viewport.boundingBox())!;
    const expand = panel.getByRole('button', { name: 'Full Screen preview' });
    const fittedExpand = (await expand.boundingBox())!;
    const fittedZoom = (await panel
      .getByRole('button', { name: 'Zoom in', exact: true })
      .boundingBox())!;
    expect(fittedExpand.x + fittedExpand.width).toBeLessThanOrEqual(fittedZoom.x);
    await image.click({ position: { x: 80, y: 90 } });
    await expect(panel.getByRole('button', { name: 'Zoom out', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/previewScale=200/);
    await expect
      .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(2550);
    await expect(panel.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
    const bounds = (await viewport.boundingBox())!;
    expect(bounds.width).toBeCloseTo(fittedBounds.width, 0);
    expect(bounds.height).toBeCloseTo(fittedBounds.height, 0);
    expect(await expand.boundingBox()).toEqual(fittedExpand);
    await expect(panel.getByRole('group', { name: 'Zoom level' })).toHaveCount(0);
    const zoomOut = (await panel
      .getByRole('button', { name: 'Zoom out', exact: true })
      .boundingBox())!;
    expect(zoomOut.y + zoomOut.height).toBeLessThanOrEqual(bounds.y);
    expect((await image.boundingBox())!.width).toBeCloseTo(bounds.width * 2, 0);
    const beforePan = await viewport.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));
    await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.75);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.4, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(panel.getByRole('button', { name: 'Zoom out', exact: true })).toBeVisible();
    const afterPan = await viewport.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));
    expect(afterPan.left).toBeGreaterThan(beforePan.left);
    expect(afterPan.top).toBeGreaterThan(beforePan.top);
    // The dialog's preview shares the zoom; design edits keep the inspected spot.
    const design = await openDesign(page);
    await openCustomize(design);
    const designViewport = design.getByRole('region', { name: 'Zoomable live board preview' });
    const designImage = design.getByRole('img');
    await expect(design.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
    await expect
      .poll(() => designImage.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(2550);
    await designViewport.evaluate((el) => {
      el.scrollLeft = 120;
      el.scrollTop = 160;
    });
    const savedPosition = await designViewport.evaluate((el) => ({
      left: el.scrollLeft,
      top: el.scrollTop,
    }));
    let before = await designImage.getAttribute('src');
    await design.getByRole('combobox', { name: 'Font', exact: true }).click();
    await page.getByRole('option', { name: 'Playfair Display', exact: true }).click();
    await expect.poll(() => designImage.getAttribute('src')).not.toBe(before);
    await expect(design.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
    await expect
      .poll(() => designImage.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(2550);
    expect(
      await designViewport.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }))
    ).toEqual(savedPosition);
    before = await designImage.getAttribute('src');
    await design.getByRole('radio', { name: 'Dashed', exact: true }).check();
    await expect.poll(() => designImage.getAttribute('src')).not.toBe(before);
    await expect(design.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
    expect(
      await designViewport.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }))
    ).toEqual(savedPosition);
    await design.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(design).toHaveCount(0);
    await expect(page).toHaveURL(/previewScale=200/);
    await expect(panel.getByRole('button', { name: 'Zoom out', exact: true })).toBeVisible();
    await page.screenshot({
      animations: 'disabled',
      path: `.scratch/theme-work/preview-inline-${width}.png`,
    });
    await panel.getByRole('button', { name: 'Full Screen preview' }).click();
    const expanded = page.getByRole('dialog', { name: 'Board preview', exact: true });
    await expect(expanded).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(expanded).toHaveCount(0);
    await expect(page).toHaveURL(/previewScale=200/);
    await expect(panel.getByRole('button', { name: 'Zoom out', exact: true })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/previewScale=200/);
    await expect(panel.getByRole('button', { name: 'Zoom out', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Next preview page' }).click();
    await expect(panel.getByText('Cards 17–24', { exact: true })).toBeVisible();
    await expect
      .poll(() => viewport.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop })))
      .toEqual({ left: 0, top: 0 });
    await panel.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect(panel.getByRole('group', { name: 'Zoom level' })).toHaveCount(0);
    await expect(
      panel.getByRole('button', { name: 'Click to zoom in on the board' })
    ).toBeFocused();
    await expect(page).not.toHaveURL(/previewScale/);
    await expect(page).toHaveURL(/previewPage=2/);
    await page.goBack();
    await expect(page).toHaveURL(/previewScale=200/);
    await expect(panel.getByRole('button', { name: 'Zoom out', exact: true })).toBeVisible();
  });
}

test('inline zoom supports keyboard and Spanish mobile preview without opening full screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, { count: 4, locale: 'es' });
  await page.getByRole('button', { name: 'Ver y descargar', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Vista previa en vivo', exact: true });
  const imageButton = sheet.getByRole('button', {
    name: 'Haz clic para acercar la tabla',
    exact: true,
  });
  await imageButton.focus();
  await imageButton.press('Enter');
  await expect(page).toHaveURL(/previewScale=200/);
  await expect(sheet.getByRole('button', { name: 'Alejar', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await expect(page.getByRole('dialog', { name: 'Vista previa ampliada' })).toHaveCount(0);
  const viewport = sheet.getByRole('region', { name: 'Vista previa de la tabla con zoom' });
  await expect(sheet.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  const button = viewport.getByRole('button');
  const before = await viewport.evaluate((el) => el.scrollLeft);
  await button.press('ArrowRight');
  expect(await viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);
  await expect(
    sheet.getByRole('button', { name: 'Descargar muestra', exact: true })
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/preview-inline-mobile-es.png',
  });
  await button.press('Escape');
  await expect(sheet).toBeVisible();
  await expect(imageButton).toBeFocused();
  await expect(sheet.getByRole('group', { name: 'Nivel de zoom' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Acercar', exact: true }).click();
  await sheet.getByRole('button', { name: 'Alejar', exact: true }).click();
  await expect(page).not.toHaveURL(/previewScale/);
  await expect(imageButton).toBeFocused();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Cerrar vista previa', exact: true }).click();
  await expect(sheet).toHaveCount(0);
});
