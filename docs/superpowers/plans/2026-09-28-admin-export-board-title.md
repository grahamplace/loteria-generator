# Admin Export Board Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Include board title" checkbox to the admin export that prints the board name (Jost, uppercase) at the top of every player board page, shrinking the cards so everything stays inside the print margins.

**Architecture:** A new pure module `lib/board-layout.ts` owns the 4×4 grid maths (with an optional title band) and title font fitting, so both are unit-testable without canvas. `renderBoardToCanvas` in `lib/generate-boards.ts` switches to that module and draws the title; `generateLoteriaSetPdf` gains a trailing `{ boardTitle }` option. The admin export button gets a checkbox that passes it.

**Tech Stack:** Next.js 16 / React 19, TypeScript, canvas 2D + jsPDF, shadcn `Checkbox` (Radix), Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-28-admin-export-board-title-design.md`

## Global Constraints

- Unchecked (default) export must produce the same board layout as today: card 507.5×761.25 px, grid top at `60 + PRINT_SAFE_MARGIN_PX`.
- Top/bottom margin with a title stays `60 + PRINT_SAFE_MARGIN_PX` px (canvas is 2550×3300 = 8.5"×11" at 300 DPI).
- `BOARD_TITLE_BAND_PX = 210`, title font `maxFontPx = 130`, `minFontPx = 60`.
- Title font string: `` `normal ${fontPx}px 'Jost', Arial, Helvetica, sans-serif` ``, colour = board `labelColor`, text uppercased.
- Title applies to player board pages only — not deck pages, caller sheet, preview boards, or the consumer export.
- UI copy uses `…` not `...`; colours only via Tailwind theme classes.
- Run tests with `pnpm vitest run <path>`; if a stale `.claude/worktrees` checkout pollutes results, scope the run to the file path.

## Review Focus

1. Very long board name (e.g. 120 chars) → font shrinks to 60px then ellipsizes with `…`; never wider than the grid. (Task 1 test)
2. Blank / whitespace-only board name with the box checked → no band, layout identical to unchecked. (Task 1 test + Task 2 code path)
3. One-word short name ("Boda") → capped at 130px, not blown up to fill the width. (Task 1 test)
4. Accented / lowercase names ("fiesta de Ñoño") → uppercased with `toLocaleUpperCase` equivalent (`toUpperCase` keeps Ñ). (Task 1 test)
5. Title band layout → grid bottom never exceeds `height − padding`; cards keep 2:3. (Task 1 test)

---

### Task 1: Pure board layout + title fitting

**Files:**

- Create: `lib/board-layout.ts`
- Test: `__tests__/lib/board-layout.test.ts`

**Interfaces:**

- Consumes: `PRINT_SAFE_MARGIN_PX` from `@/lib/constants`.
- Produces:
  - `export const BOARD_TITLE_BAND_PX = 210;`
  - `export const BOARD_TITLE_MAX_FONT_PX = 130;`
  - `export const BOARD_TITLE_MIN_FONT_PX = 60;`
  - `export interface BoardLayout { cardWidth: number; cardHeight: number; cardSpacing: number; offsetX: number; offsetY: number; gridWidth: number; gridHeight: number; titleBand: { top: number; height: number } | null }`
  - `export function computeBoardLayout(opts: { width: number; height: number; titleBandHeight?: number }): BoardLayout`
  - `export function fitBoardTitle(opts: { text: string; maxWidth: number; maxFontPx: number; minFontPx: number; measureAtFont: (fontPx: number, text: string) => number }): { fontPx: number; text: string } | null`

- [ ] **Step 1: Write the failing test** — `__tests__/lib/board-layout.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  computeBoardLayout,
  fitBoardTitle,
  BOARD_TITLE_BAND_PX,
  BOARD_TITLE_MAX_FONT_PX,
  BOARD_TITLE_MIN_FONT_PX,
} from '@/lib/board-layout';
import { PRINT_SAFE_MARGIN_PX } from '@/lib/constants';

const W = 2550;
const H = 3300;
const PADDING = 60 + PRINT_SAFE_MARGIN_PX;

// Fake measurer: every character is 0.6em wide.
const measureAtFont = (fontPx: number, text: string) => [...text].length * fontPx * 0.6;

describe('computeBoardLayout', () => {
  it('reproduces the untitled layout exactly', () => {
    const layout = computeBoardLayout({ width: W, height: H });
    expect(layout.cardWidth).toBeCloseTo(507.5, 5);
    expect(layout.cardHeight).toBeCloseTo(761.25, 5);
    expect(layout.cardSpacing).toBe(20);
    expect(layout.offsetY).toBeCloseTo(PADDING, 5);
    expect(layout.offsetX).toBeCloseTo((W - layout.gridWidth) / 2, 5);
    expect(layout.titleBand).toBeNull();
  });

  it('treats a zero band as no title', () => {
    expect(computeBoardLayout({ width: W, height: H, titleBandHeight: 0 }).titleBand).toBeNull();
  });

  it('reserves a title band above a smaller grid inside the same margins', () => {
    const plain = computeBoardLayout({ width: W, height: H });
    const titled = computeBoardLayout({ width: W, height: H, titleBandHeight: BOARD_TITLE_BAND_PX });

    expect(titled.titleBand).not.toBeNull();
    expect(titled.titleBand!.top).toBeCloseTo(PADDING, 5);
    expect(titled.titleBand!.height).toBe(BOARD_TITLE_BAND_PX);
    expect(titled.offsetY).toBeCloseTo(PADDING + BOARD_TITLE_BAND_PX, 5);
    expect(titled.offsetY + titled.gridHeight).toBeLessThanOrEqual(H - PADDING + 1e-6);
    expect(titled.cardHeight).toBeLessThan(plain.cardHeight);
    expect(titled.cardWidth / titled.cardHeight).toBeCloseTo(2 / 3, 5);
    expect(titled.offsetX).toBeCloseTo((W - titled.gridWidth) / 2, 5);
  });
});

describe('fitBoardTitle', () => {
  const base = {
    maxWidth: 2000,
    maxFontPx: BOARD_TITLE_MAX_FONT_PX,
    minFontPx: BOARD_TITLE_MIN_FONT_PX,
    measureAtFont,
  };

  it('returns null for blank text', () => {
    expect(fitBoardTitle({ ...base, text: '' })).toBeNull();
    expect(fitBoardTitle({ ...base, text: '   \n ' })).toBeNull();
  });

  it('trims, uppercases, and caps a short title at the max font size', () => {
    expect(fitBoardTitle({ ...base, text: '  Boda  ' })).toEqual({
      fontPx: BOARD_TITLE_MAX_FONT_PX,
      text: 'BODA',
    });
  });

  it('keeps accented characters when uppercasing', () => {
    expect(fitBoardTitle({ ...base, text: 'fiesta de Ñoño' })!.text).toBe('FIESTA DE ÑOÑO');
  });

  it('shrinks the font until the title fits', () => {
    // 30 chars: fits at 111px (30*111*0.6 = 1998) but not at 112px.
    const fit = fitBoardTitle({ ...base, text: 'a'.repeat(30) })!;
    expect(fit.fontPx).toBe(111);
    expect(fit.text).toBe('A'.repeat(30));
    expect(measureAtFont(fit.fontPx, fit.text)).toBeLessThanOrEqual(base.maxWidth);
  });

  it('ellipsizes at the min font size when shrinking is not enough', () => {
    const fit = fitBoardTitle({ ...base, text: 'x'.repeat(120) })!;
    expect(fit.fontPx).toBe(BOARD_TITLE_MIN_FONT_PX);
    expect(fit.text.endsWith('…')).toBe(true);
    expect(measureAtFont(fit.fontPx, fit.text)).toBeLessThanOrEqual(base.maxWidth);
    // 2000 / (60*0.6) = 55.5 → 54 x's + "…"
    expect(fit.text).toBe('X'.repeat(54) + '…');
  });

  it('does not leave a trailing space before the ellipsis', () => {
    const text = 'word '.repeat(40);
    const fit = fitBoardTitle({ ...base, text })!;
    expect(fit.text).not.toMatch(/\s…$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/lib/board-layout.test.ts`
Expected: FAIL — cannot resolve `@/lib/board-layout`.

- [ ] **Step 3: Write the implementation** — `lib/board-layout.ts`

```ts
/**
 * Pure layout helpers for a 4×4 player board page. Kept free of canvas so the
 * grid maths and title fitting can be unit tested with an injected measurer.
 */
import { PRINT_SAFE_MARGIN_PX } from '@/lib/constants';

/** Height (px at 300 DPI, 0.7") reserved above the grid for a board title. */
export const BOARD_TITLE_BAND_PX = 210;
export const BOARD_TITLE_MAX_FONT_PX = 130;
export const BOARD_TITLE_MIN_FONT_PX = 60;

const ROWS = 4;
const COLS = 4;
const CARD_SPACING = 20;
const CARD_ASPECT_RATIO = 2 / 3;
// The 4×4 grid is height-constrained, so this padding is the printed top and
// bottom margin verbatim — 0.2" before the print-safe margin was added.
const PADDING = 60 + PRINT_SAFE_MARGIN_PX;

export interface BoardLayout {
  cardWidth: number;
  cardHeight: number;
  cardSpacing: number;
  /** Left edge of the grid. */
  offsetX: number;
  /** Top edge of the grid. */
  offsetY: number;
  gridWidth: number;
  gridHeight: number;
  /** Band above the grid for the board title, or null when untitled. */
  titleBand: { top: number; height: number } | null;
}

/**
 * Sizes and positions the 4×4 card grid on a page. A title band comes off the
 * available height, so cards shrink (keeping 2:3) rather than the margins; the
 * band + grid block is centred vertically with the band on top.
 */
export function computeBoardLayout({
  width,
  height,
  titleBandHeight = 0,
}: {
  width: number;
  height: number;
  titleBandHeight?: number;
}): BoardLayout {
  const band = Math.max(0, titleBandHeight);
  const availableWidth = width - PADDING * 2 - CARD_SPACING * (COLS - 1);
  const availableHeight = height - PADDING * 2 - CARD_SPACING * (ROWS - 1) - band;

  const maxCardWidth = availableWidth / COLS;
  const maxCardHeight = availableHeight / ROWS;

  let cardWidth: number;
  let cardHeight: number;
  if (maxCardWidth / maxCardHeight < CARD_ASPECT_RATIO) {
    cardWidth = maxCardWidth;
    cardHeight = cardWidth / CARD_ASPECT_RATIO;
  } else {
    cardHeight = maxCardHeight;
    cardWidth = cardHeight * CARD_ASPECT_RATIO;
  }

  const gridWidth = cardWidth * COLS + CARD_SPACING * (COLS - 1);
  const gridHeight = cardHeight * ROWS + CARD_SPACING * (ROWS - 1);
  const blockTop = (height - (band + gridHeight)) / 2;

  return {
    cardWidth,
    cardHeight,
    cardSpacing: CARD_SPACING,
    offsetX: (width - gridWidth) / 2,
    offsetY: blockTop + band,
    gridWidth,
    gridHeight,
    titleBand: band > 0 ? { top: blockTop, height: band } : null,
  };
}

/**
 * Fits a board title onto one line: uppercases it, shrinks the font 1px at a
 * time down to minFontPx, then truncates with "…" if it still overflows.
 * Returns null for blank text, meaning "draw no title".
 */
export function fitBoardTitle({
  text,
  maxWidth,
  maxFontPx,
  minFontPx,
  measureAtFont,
}: {
  text: string;
  maxWidth: number;
  maxFontPx: number;
  minFontPx: number;
  measureAtFont: (fontPx: number, text: string) => number;
}): { fontPx: number; text: string } | null {
  const title = text.trim().replace(/\s+/g, ' ').toUpperCase();
  if (title === '') return null;

  for (let fontPx = maxFontPx; fontPx >= minFontPx; fontPx--) {
    if (measureAtFont(fontPx, title) <= maxWidth) return { fontPx, text: title };
  }

  const chars = [...title];
  for (let n = chars.length - 1; n > 0; n--) {
    const candidate = chars.slice(0, n).join('').trimEnd() + '…';
    if (measureAtFont(minFontPx, candidate) <= maxWidth) {
      return { fontPx: minFontPx, text: candidate };
    }
  }
  return { fontPx: minFontPx, text: '…' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/lib/board-layout.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/board-layout.ts __tests__/lib/board-layout.test.ts
git commit -m "feat(export): pure board layout with optional title band"
```

---

### Task 2: Render the title on board pages

**Files:**

- Modify: `lib/generate-boards.ts` (`renderBoardToCanvas`, `generateLoteriaSetPdf`)

**Interfaces:**

- Consumes: `computeBoardLayout`, `fitBoardTitle`, `BOARD_TITLE_BAND_PX`, `BOARD_TITLE_MAX_FONT_PX`, `BOARD_TITLE_MIN_FONT_PX` from `./board-layout` (Task 1).
- Produces:
  - `export interface LoteriaSetPdfOptions { boardTitle?: string }` — printed at the top of every player board page when non-blank.
  - `generateLoteriaSetPdf(cards, styleOptions?, onProgress?, callerSheetLabels?, boardCount?, options?: LoteriaSetPdfOptions)` — new trailing param, default `{}`.

Canvas is not available in jsdom, so this task is verified by typecheck, lint, the existing tests, and the controller's manual check (Task 4).

- [ ] **Step 1: Import the layout module** — add near the other imports in `lib/generate-boards.ts`:

```ts
import {
  computeBoardLayout,
  fitBoardTitle,
  BOARD_TITLE_BAND_PX,
  BOARD_TITLE_MAX_FONT_PX,
  BOARD_TITLE_MIN_FONT_PX,
} from './board-layout';
```

`PRINT_SAFE_MARGIN_PX` stays imported — `renderDeckPageToCanvas` still uses it.

- [ ] **Step 2: Rewrite `renderBoardToCanvas`**

Signature gains `title?: string` as a third param. Keep the canvas setup and background fill as-is. Then, in this order:

1. Move the two `loadGoogleFont(...)` calls (Caveat, Jost — same URLs as today) up to directly after the background fill, with the comment `// Loaded before any text is measured so the title fits against real Jost metrics.`
2. Replace the inline grid maths (`rows`/`cols`/`padding`/`cardSpacing`/`availableWidth`… through `offsetY`) with:

```ts
  const hasTitle = (title ?? '').trim() !== '';
  const layout = computeBoardLayout({
    width,
    height,
    titleBandHeight: hasTitle ? BOARD_TITLE_BAND_PX : 0,
  });
  const { cardWidth, cardHeight, cardSpacing, offsetX, offsetY, titleBand } = layout;

  if (titleBand) {
    const titleFont = (fontPx: number) =>
      `normal ${fontPx}px 'Jost', Arial, Helvetica, sans-serif`;
    const fit = fitBoardTitle({
      text: title ?? '',
      maxWidth: layout.gridWidth,
      maxFontPx: BOARD_TITLE_MAX_FONT_PX,
      minFontPx: BOARD_TITLE_MIN_FONT_PX,
      measureAtFont: (fontPx, s) => {
        ctx.font = titleFont(fontPx);
        return ctx.measureText(s).width;
      },
    });
    if (fit) {
      // Matches the card labels: Jost, uppercase, label colour.
      ctx.fillStyle = labelColor;
      ctx.font = titleFont(fit.fontPx);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fit.text, width / 2, titleBand.top + titleBand.height / 2);
    }
  }
```

3. Keep the image loading and the card-drawing loop unchanged, declaring `const rows = 4; const cols = 4;` just above the loop.

Update the doc comment to add: "A non-blank title is drawn in a band above the grid; the cards shrink to make room so the page margins are unchanged."

- [ ] **Step 3: Add the option to `generateLoteriaSetPdf`**

Above the function:

```ts
export interface LoteriaSetPdfOptions {
  /** Printed at the top of every player board page when non-blank. */
  boardTitle?: string;
}
```

Add a trailing param `options: LoteriaSetPdfOptions = {}` after `boardCount`, and change the board-loop render call to:

```ts
    const canvas = await renderBoardToCanvas(boards[i], styleOptions, options.boardTitle);
```

Leave `renderDeckPageToCanvas` and `generatePreviewBoardsPdf` untouched.

- [ ] **Step 4: Verify**

Run: `pnpm tsc --noEmit -p . 2>&1 | grep -v '\.claude/' | head` — expected: no errors.
Run: `pnpm vitest run __tests__/lib/generate-boards.test.ts __tests__/lib/board-layout.test.ts` — expected: PASS.
Run: `pnpm eslint lib/generate-boards.ts lib/board-layout.ts` — expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/generate-boards.ts
git commit -m "feat(export): draw optional board title on player board pages"
```

---

### Task 3: Admin checkbox

**Files:**

- Modify: `app/(admin)/admin/components/admin-export-button.tsx`
- Test: `__tests__/components/admin-export-button.test.tsx`

**Interfaces:**

- Consumes: `generateLoteriaSetPdf(..., boardCount, { boardTitle })` and `LoteriaSetPdfOptions` from `@/lib/generate-boards` (Task 2); `Checkbox` from `@/components/ui/checkbox`.
- Produces: UI only.

- [ ] **Step 1: Write the failing test** — `__tests__/components/admin-export-button.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Card } from '@/db/schema';

const generateLoteriaSetPdf = vi.fn(async () => new Blob(['pdf']));

vi.mock('@/lib/generate-boards', () => ({
  generateLoteriaSetPdf: (...args: unknown[]) => generateLoteriaSetPdf(...(args as [])),
  clampBoardCount: (n: number) => n,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/admin-card-image', () => ({
  adminCardImageSrc: (c: { illustrationUrl: string | null }) => c.illustrationUrl,
}));

import { AdminExportButton } from '@/app/(admin)/admin/components/admin-export-button';

const cards = Array.from({ length: 16 }, (_, i) => ({
  id: `card-${i}`,
  number: i + 1,
  label: `Card ${i + 1}`,
  status: 'completed',
  illustrationUrl: `/img/${i}.webp`,
  riddle: null,
})) as unknown as Card[];

describe('AdminExportButton', () => {
  beforeEach(() => {
    generateLoteriaSetPdf.mockClear();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  it('leaves the board title checkbox unchecked by default', () => {
    render(<AdminExportButton boardName="Boda de Ana" cards={cards} />);
    expect(screen.getByRole('checkbox', { name: 'Include board title' })).not.toBeChecked();
  });

  it('exports without a title when unchecked', async () => {
    render(<AdminExportButton boardName="Boda de Ana" cards={cards} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(generateLoteriaSetPdf).toHaveBeenCalledTimes(1));
    const args = generateLoteriaSetPdf.mock.calls[0] as unknown[];
    expect(args[5]).toEqual({ boardTitle: undefined });
  });

  it('passes the board name as the title when checked', async () => {
    render(<AdminExportButton boardName="Boda de Ana" cards={cards} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include board title' }));
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(generateLoteriaSetPdf).toHaveBeenCalledTimes(1));
    const args = generateLoteriaSetPdf.mock.calls[0] as unknown[];
    expect(args[5]).toEqual({ boardTitle: 'Boda de Ana' });
  });
});
```

If `getByRole('button', { name: /export/i })` matches more than one button (the stepper buttons are named "Fewer boards"/"More boards", so it should not), use `{ name: 'Export' }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/components/admin-export-button.test.tsx`
Expected: FAIL — no checkbox named "Include board title".

- [ ] **Step 3: Implement** — in `admin-export-button.tsx`:

Add import:

```ts
import { Checkbox } from '@/components/ui/checkbox';
```

Add state beside `boardCount`:

```ts
const [includeTitle, setIncludeTitle] = useState(false);
```

Change the `generateLoteriaSetPdf` call's trailing args:

```ts
        boardCount,
        { boardTitle: includeTitle ? boardName : undefined }
      );
```

Render the checkbox between `<BoardCountStepper … />` and `<Button>`; the `<label>` wraps both box and text so they share one hit target:

```tsx
<label className="inline-flex min-h-6 cursor-pointer items-center gap-1.5 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
  <Checkbox
    checked={includeTitle}
    onCheckedChange={(checked) => setIncludeTitle(checked === true)}
    disabled={isExporting || !canExport}
  />
  Include board title
</label>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run __tests__/components/admin-export-button.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Full checks**

Run: `pnpm vitest run __tests__` — expected: all pass.
Run: `pnpm lint` and `pnpm tsc --noEmit -p .` — expected: clean (ignore `.claude/worktrees` noise).

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/components/admin-export-button.tsx" __tests__/components/admin-export-button.test.tsx
git commit -m "feat(admin): include-board-title checkbox on export"
```

---

### Task 4 (controller, not a subagent): Manual PDF check

- Run the render in a real browser (the dev server's admin board page, or a scratch page calling `generateLoteriaSetPdf` with `{ boardTitle }`), render one titled board page to PNG, and inspect: title is Jost uppercase, centred, cards unclipped, bottom margin unchanged. Also a 120-char name to see the ellipsis.
