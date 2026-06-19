# Admin Editable Crop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make preserve-mode card crops editable after upload. Store the full (downscaled) original + a `cropData` rectangle + a `preserveOriginal` flag; the image proxy crops at serve time with `sharp.extract()`. Re-crop = update coordinates (lossless, no re-upload).

**Architecture:** Coordinates are the source of truth. Client uploads the full downscaled original + `cropData` (downscaled px). Proxy applies the crop for preserve cards on the `illustration` type. A Re-crop modal on the admin card page edits `cropData` via PATCH.

**Branch:** `feat/admin-editable-crop`, stacked on `feat/admin-cropped-photo-board`. Do NOT switch branches.

**Tech:** Next.js 16, TypeScript, Drizzle/Neon, Inngest, sharp, react-image-crop, Vitest.

**Test command:** `pnpm exec vitest run <file> --exclude '**/.claude/**'`. Final: `pnpm typecheck` + `pnpm exec vitest run __tests__ --exclude '**/.claude/**'`.

**Coordinate-space invariant (critical):** `cropData` is always in pixels of the *stored* (downscaled) original blob. On bulk upload, the crop modal runs on the full-res file, so its crop is scaled by the downscale factor before sending. On re-crop, the modal runs on the already-downscaled stored original, so no scaling is needed. The proxy and the Inngest AI branch both extract against the stored blob, so spaces always match.

---

## Task 1: Schema — `preserveOriginal` + `cropData` columns + migration

**Files:** `db/schema.ts`, `db/migrations/0008_*.sql` (generated)

- [ ] **Step 1: Add the type + columns**

In `db/schema.ts`, after the `BoardStyleOptions` interface (around line 74) add:

```ts
// Crop rectangle in pixels of the stored (downscaled) original image.
export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

In the `cards` table definition, add these two columns (after `defaultCardId`):

```ts
  preserveOriginal: boolean('preserve_original').notNull().default(false),
  cropData: json('crop_data').$type<CropData>(),
```

(`json` and `boolean` are already imported from `drizzle-orm/pg-core`.)

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `db/migrations/0008_*.sql` containing `ALTER TABLE "cards" ADD COLUMN "preserve_original" boolean ...` and `ADD COLUMN "crop_data" json;`. It should NOT prompt (pure additions). Verify the file exists and content looks right.

- [ ] **Step 3: Apply to the dev DB**

Run: `pnpm db:migrate`
Expected: applies cleanly. If it cannot connect (no DB creds in this environment), that's OK — report it; the generated SQL is the required deliverable and the controller will apply it.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm typecheck` (no new errors in schema)
```bash
git add db/schema.ts db/migrations/
git commit -m "feat(db): add preserveOriginal + cropData columns to cards"
```

---

## Task 2: Pure/server helpers — crop-region + downscale

**Files:**
- Create: `lib/crop-region.ts`, `lib/downscale-image.ts`
- Test: `__tests__/lib/crop-region.test.ts`, `__tests__/lib/downscale-image.test.ts`

- [ ] **Step 1: Write the failing tests**

`__tests__/lib/crop-region.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { cropExtractRegion, scaleRect, extractCrop } from '@/lib/crop-region';

describe('cropExtractRegion', () => {
  it('passes through an in-bounds rect as sharp extract params', () => {
    expect(cropExtractRegion({ x: 10, y: 20, width: 30, height: 40 }, 100, 100)).toEqual({
      left: 10,
      top: 20,
      width: 30,
      height: 40,
    });
  });

  it('clamps a rect that overflows the image', () => {
    expect(cropExtractRegion({ x: 90, y: 90, width: 50, height: 50 }, 100, 100)).toEqual({
      left: 90,
      top: 90,
      width: 10,
      height: 10,
    });
  });

  it('returns null for a degenerate rect', () => {
    expect(cropExtractRegion({ x: 100, y: 0, width: 10, height: 10 }, 100, 100)).toBeNull();
    expect(cropExtractRegion({ x: 0, y: 0, width: 0, height: 10 }, 100, 100)).toBeNull();
  });
});

describe('scaleRect', () => {
  it('scales and rounds', () => {
    expect(scaleRect({ x: 10, y: 20, width: 30, height: 40 }, 0.5)).toEqual({
      x: 5,
      y: 10,
      width: 15,
      height: 20,
    });
  });

  it('is identity at scale 1', () => {
    expect(scaleRect({ x: 1, y: 2, width: 3, height: 4 }, 1)).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
  });
});

describe('extractCrop', () => {
  it('crops a real image to the requested region size', async () => {
    const src = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const out = await extractCrop(src, { x: 10, y: 10, width: 40, height: 30 });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(30);
  });

  it('returns the source unchanged when the crop is degenerate', async () => {
    const src = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const out = await extractCrop(src, { x: 999, y: 0, width: 10, height: 10 });
    expect(out).toBe(src);
  });
});
```

`__tests__/lib/downscale-image.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeDownscaleDimensions } from '@/lib/downscale-image';

describe('computeDownscaleDimensions', () => {
  it('scales the longest side down to max, preserving aspect', () => {
    expect(computeDownscaleDimensions(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
  });

  it('scales by height when portrait', () => {
    expect(computeDownscaleDimensions(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it('never upscales', () => {
    expect(computeDownscaleDimensions(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it('rounds to whole pixels', () => {
    expect(computeDownscaleDimensions(2049, 1000, 2048)).toEqual({ width: 2048, height: 999 });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (modules missing): `pnpm exec vitest run __tests__/lib/crop-region.test.ts __tests__/lib/downscale-image.test.ts`

- [ ] **Step 3: Implement**

`lib/crop-region.ts`:

```ts
import sharp from 'sharp';
import type { CropData } from '@/db/schema';

export interface ExtractRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Clamp a crop rect (in image pixels) to the image bounds and convert to sharp
 * extract params. Returns null if the rect is degenerate (off-image or zero
 * area) — callers should serve/keep the full image in that case. Pure.
 */
export function cropExtractRegion(crop: CropData, imgWidth: number, imgHeight: number): ExtractRegion | null {
  const left = Math.max(0, Math.round(crop.x));
  const top = Math.max(0, Math.round(crop.y));
  if (left >= imgWidth || top >= imgHeight) return null;
  const width = Math.min(imgWidth - left, Math.round(crop.width));
  const height = Math.min(imgHeight - top, Math.round(crop.height));
  if (width <= 0 || height <= 0) return null;
  return { left, top, width, height };
}

/** Scale a crop rect by a factor and round (e.g. full-res → downscaled space). Pure. */
export function scaleRect(crop: CropData, scale: number): CropData {
  return {
    x: Math.round(crop.x * scale),
    y: Math.round(crop.y * scale),
    width: Math.round(crop.width * scale),
    height: Math.round(crop.height * scale),
  };
}

/**
 * Crop an image buffer to the given rect using sharp. If the rect is degenerate
 * relative to the actual image, returns the original buffer unchanged.
 */
export async function extractCrop(buffer: Buffer, crop: CropData): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const region = cropExtractRegion(crop, meta.width ?? 0, meta.height ?? 0);
  if (!region) return buffer;
  return sharp(buffer).extract(region).toBuffer();
}
```

`lib/downscale-image.ts`:

```ts
export interface Dimensions {
  width: number;
  height: number;
}

/** Scale the longest side down to `max`, preserving aspect ratio. Never upscales. Pure. */
export function computeDownscaleDimensions(width: number, height: number, max: number): Dimensions {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Downscale an image File to a max longest-side dimension via canvas, returning
 * a data URL plus the applied scale factor (1 if no downscale). Browser-only.
 */
export async function downscaleToDataUrl(
  file: File,
  max: number
): Promise<{ dataUrl: string; scale: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = computeDownscaleDimensions(bitmap.width, bitmap.height, max);
  const scale = bitmap.width === 0 ? 1 : width / bitmap.width;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { dataUrl: canvas.toDataURL(mime, 0.92), scale };
}
```

- [ ] **Step 4: Run — expect PASS** (both files). Run: `pnpm exec vitest run __tests__/lib/crop-region.test.ts __tests__/lib/downscale-image.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/crop-region.ts lib/downscale-image.ts __tests__/lib/crop-region.test.ts __tests__/lib/downscale-image.test.ts
git commit -m "feat: add crop-region (extract/clamp/scale) and downscale-image helpers"
```

---

## Task 3: Validation — `cropData` on create + update schemas

**Files:** `lib/validations.ts`, `__tests__/lib/validations.test.ts`

- [ ] **Step 1: Append failing tests** to `__tests__/lib/validations.test.ts` (reuse existing `createCardSchema`/`updateCardSchema` imports; add `updateCardSchema` to the import if missing):

```ts
describe('cropData on card schemas', () => {
  const crop = { x: 1, y: 2, width: 3, height: 4 };
  it('createCardSchema accepts cropData', () => {
    const p = createCardSchema.safeParse({ skipIllustration: true, cropData: crop });
    expect(p.success).toBe(true);
    if (p.success) expect(p.data.cropData).toEqual(crop);
  });
  it('updateCardSchema accepts cropData', () => {
    const p = updateCardSchema.safeParse({ cardId: '11111111-1111-1111-1111-111111111111', cropData: crop });
    expect(p.success).toBe(true);
  });
  it('rejects malformed cropData', () => {
    expect(createCardSchema.safeParse({ cropData: { x: 'a', y: 2, width: 3, height: 4 } }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `pnpm exec vitest run __tests__/lib/validations.test.ts`

- [ ] **Step 3: Implement** in `lib/validations.ts`. Add a shared schema near the top (after `base64ImageString`):

```ts
const cropDataSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
```

Add `cropData: cropDataSchema.optional(),` to `createCardSchema`, and `cropData: cropDataSchema.nullish(),` to `updateCardSchema`.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/validations.ts __tests__/lib/validations.test.ts
git commit -m "feat: accept cropData in create/update card schemas"
```

---

## Task 4: Inngest — `cropData` event field + AI branch crops the source

**Files:** `lib/inngest/events.ts`, `lib/inngest/functions/generate-card-artwork.ts`, `__tests__/lib/generate-card-artwork.test.ts`

- [ ] **Step 1: Append failing test** to `__tests__/lib/generate-card-artwork.test.ts`. First add a mock for the crop helper near the other `vi.mock` calls at the top of the file:

```ts
const { extractCrop } = vi.hoisted(() => ({ extractCrop: vi.fn(async (b: Buffer) => b) }));
vi.mock('@/lib/crop-region', () => ({ extractCrop }));
```

Then append:

```ts
describe('generate-card-artwork cropData (AI branch)', () => {
  it('crops the source before AI when cropData is present', async () => {
    chatCreate.mockResolvedValue({ choices: [{ message: { content: 'La Luna' } }] });
    const { step } = makeStep();
    await captured.handler!({
      event: {
        data: {
          cardId: CARD,
          boardId: BOARD,
          userId: 'u1',
          originalImageUrl: 'https://blob/o.png',
          cropData: { x: 1, y: 2, width: 3, height: 4 },
        },
      },
      step,
    });
    expect(extractCrop).toHaveBeenCalled();
    expect(imagesEdit).toHaveBeenCalled();
  });

  it('does not crop when cropData is absent', async () => {
    chatCreate.mockResolvedValue({ choices: [{ message: { content: 'La Luna' } }] });
    const { step } = makeStep();
    await captured.handler!({
      event: { data: { cardId: CARD, boardId: BOARD, userId: 'u1', originalImageUrl: 'https://blob/o.png' } },
      step,
    });
    expect(extractCrop).not.toHaveBeenCalled();
  });
});
```

(If `extractCrop` must be reset between tests, the file's existing `beforeEach` already calls `vi.clearAllMocks()` — confirm and rely on it.)

- [ ] **Step 2: Run — expect FAIL.** `pnpm exec vitest run __tests__/lib/generate-card-artwork.test.ts`

- [ ] **Step 3a:** In `lib/inngest/events.ts`, add to the `cardGenerateRequested` schema (after `skipIllustration`):

```ts
    cropData: z
      .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
      .optional(),
```

- [ ] **Step 3b:** In `lib/inngest/functions/generate-card-artwork.ts`:
  - Add import: `import { extractCrop } from '@/lib/crop-region';`
  - Destructure `cropData` from `event.data` (alongside `skipIllustration`).
  - In the AI illustration branch, inside the `generate-and-upload-illustration` step, after `const { buffer, contentType } = await fetchBlob(originalImageUrl);` and the mime check, crop before normalizing:

```ts
        const sourceBuffer = cropData ? await extractCrop(buffer, cropData) : buffer;
        const normalized = await normalizeImageForOpenAI(sourceBuffer);
```

  (Replace the existing `const normalized = await normalizeImageForOpenAI(buffer);` line.) Leave the preserve branch and everything else unchanged.

- [ ] **Step 4: Run — expect PASS** (all tests). Also `pnpm typecheck` (no new errors).

- [ ] **Step 5: Commit**

```bash
git add lib/inngest/events.ts lib/inngest/functions/generate-card-artwork.ts __tests__/lib/generate-card-artwork.test.ts
git commit -m "feat: crop the AI source server-side when cropData is present"
```

---

## Task 5: Card route — persist `preserveOriginal`/`cropData` (POST) + `cropData` (PATCH)

**Files:** `app/api/boards/[boardId]/cards/route.ts`, `__tests__/api/cards-create-admin.test.ts`, `__tests__/api/cards-patch-cropdata.test.ts` (new)

- [ ] **Step 1: Append a POST test** to `__tests__/api/cards-create-admin.test.ts`:

```ts
describe('POST /api/boards/[boardId]/cards persists preserveOriginal + cropData', () => {
  it('admin: inserts preserveOriginal from skipIllustration and cropData, and sends cropData', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    boardsFindFirst.mockResolvedValue({ id: 'board-1', userId: 'admin-1', isUnlocked: true, imageGenerationsUsed: 0 });
    const crop = { x: 1, y: 2, width: 3, height: 4 };
    const res = await POST(
      makeReq({ originalImageBase64: IMG, label: 'X', skipIllustration: true, cropData: crop }),
      { params }
    );
    expect(res.status).toBe(201);
    expect(insertValuesSpy.mock.calls[0][0]).toMatchObject({ preserveOriginal: true, cropData: crop });
    expect(sendMock.mock.calls[0][0].data.cropData).toEqual(crop);
  });

  it('non-admin: preserveOriginal false and cropData not persisted', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    boardsFindFirst.mockResolvedValue({ id: 'board-1', userId: 'user-1', isUnlocked: false, imageGenerationsUsed: 0 });
    const res = await POST(
      makeReq({ originalImageBase64: IMG, label: 'X', skipIllustration: true, cropData: { x: 1, y: 2, width: 3, height: 4 } }),
      { params }
    );
    expect(res.status).toBe(201);
    expect(insertValuesSpy.mock.calls[0][0]).toMatchObject({ preserveOriginal: false });
    expect(insertValuesSpy.mock.calls[0][0].cropData ?? null).toBeNull();
  });
});
```

- [ ] **Step 2: Create the PATCH test** `__tests__/api/cards-patch-cropdata.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { cardsFindFirst, updateSetSpy } = vi.hoisted(() => ({
  cardsFindFirst: vi.fn(),
  updateSetSpy: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: { cards: { findFirst: (...a: unknown[]) => cardsFindFirst(...a) } },
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updateSetSpy(v);
        return { where: () => ({ returning: () => Promise.resolve([{ id: 'c1', ...v }]) }) };
      },
    }),
  },
  cards: {},
}));
vi.mock('@/lib/blob', () => ({
  uploadIllustration: vi.fn(),
  base64ToBuffer: vi.fn(),
  deleteCardImages: vi.fn(),
  uploadOriginalImage: vi.fn(),
  getContentTypeFromDataUrl: vi.fn(),
}));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));

import { auth } from '@/lib/auth';
import { PATCH } from '@/app/api/boards/[boardId]/cards/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const params = Promise.resolve({ boardId: 'board-1' });
const crop = { x: 5, y: 6, width: 7, height: 8 };

function makeReq(body: unknown) {
  return new Request('http://localhost/api/boards/board-1/cards', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  cardsFindFirst.mockResolvedValue({ id: 'c1', boardId: 'board-1', userId: 'admin-1' });
});

describe('PATCH /api/boards/[boardId]/cards cropData', () => {
  it('admin persists cropData', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    const res = await PATCH(makeReq({ cardId: '11111111-1111-1111-1111-111111111111', cropData: crop }), { params });
    expect(res.status).toBe(200);
    const setArg = updateSetSpy.mock.calls.map((c) => c[0]).find((v) => 'cropData' in v);
    expect(setArg?.cropData).toEqual(crop);
  });
});
```

Note: the PATCH ownership lookup uses the *body* `cardId`, but the test's `cardsFindFirst` returns a fixed card; the `cardId` in the body must be a valid uuid to pass `updateCardSchema`. Adjust the uuid if the route reads it differently.

- [ ] **Step 3: Run both — expect FAIL.**
`pnpm exec vitest run __tests__/api/cards-create-admin.test.ts __tests__/api/cards-patch-cropdata.test.ts`

- [ ] **Step 4: Implement** in `app/api/boards/[boardId]/cards/route.ts`:

POST handler:
- After `const skipIllustration = isAdmin && parsed.data.skipIllustration === true;`, add:
  ```ts
    const cropData = isAdmin ? (parsed.data.cropData ?? null) : null;
  ```
- In the card `db.insert(cards).values({...})`, add `preserveOriginal: skipIllustration,` and `cropData,`.
- In the `cardGenerateRequested.create({ ... })` payload, add `cropData: cropData ?? undefined,`.

PATCH handler:
- Add `const isAdmin = isAdminEmail(session.user.email);` after the session check (import is already present at top of file).
- Destructure `cropData` from the parsed body (add to the existing destructure of `updateCardSchema` result).
- Where other fields are conditionally added to `updateData`, add:
  ```ts
    if (isAdmin && cropData !== undefined) {
      updateData.cropData = cropData;
    }
  ```

- [ ] **Step 5: Run both — expect PASS.** Then `pnpm exec eslint "app/api/boards/[boardId]/cards/route.ts"`.

- [ ] **Step 6: Commit**

```bash
git add "app/api/boards/[boardId]/cards/route.ts" __tests__/api/cards-create-admin.test.ts __tests__/api/cards-patch-cropdata.test.ts
git commit -m "feat: persist preserveOriginal + cropData on card create and patch"
```

---

## Task 6: Consumer image proxy — serve-time crop

**Files:** `app/api/images/[...path]/route.ts`

(No unit test — sharp pipeline is browser/integration-verified; `cropExtractRegion` is covered in Task 2.)

- [ ] **Step 1:** Add import at the top: `import { cropExtractRegion } from '@/lib/crop-region';`

- [ ] **Step 2:** Replace the private-blob branch (`if (isPrivateBlob) { ... }`) so it applies a crop for preserve cards. Inside that branch, after `const result = await getPrivateBlob(imageUrl);` and the `result?.statusCode !== 200` guard, replace the existing resize block with:

```ts
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
        if (resizeWidth) pipeline = pipeline.resize({ width: resizeWidth, withoutEnlargement: true });
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
```

(This generalizes the old resize-only block to crop-and/or-resize and leaves the raw-stream fallback for the no-op case.)

- [ ] **Step 3: Verify** `pnpm typecheck` (no new errors) and `pnpm exec eslint "app/api/images/[...path]/route.ts"`.

- [ ] **Step 4: Commit**

```bash
git add "app/api/images/[...path]/route.ts"
git commit -m "feat: apply preserve-card crop at serve time in image proxy"
```

---

## Task 7: Admin image proxy — serve-time crop

**Files:** `app/api/admin/images/[cardId]/[type]/route.ts`

- [ ] **Step 1:** Add imports: `import sharp from 'sharp';` and `import { cropExtractRegion } from '@/lib/crop-region';`. Add a `streamToBuffer` helper (copy the one from the consumer proxy) at module scope.

- [ ] **Step 2:** In the `if (isPrivateBlob)` branch, after the `result?.statusCode !== 200` guard, apply crop for preserve illustration before returning:

```ts
      const cropRect =
        type === 'illustration' && card.preserveOriginal && card.cropData ? card.cropData : null;

      if (cropRect) {
        const etag = `"${result.blob.etag}-crop${cropRect.x}-${cropRect.y}-${cropRect.width}-${cropRect.height}"`;
        if (request.headers.get('if-none-match') === etag) {
          return new NextResponse(null, {
            status: 304,
            headers: { ETag: etag, 'Cache-Control': 'private, no-cache' },
          });
        }
        const source = await streamToBuffer(result.stream);
        const meta = await sharp(source).metadata();
        const region = cropExtractRegion(cropRect, meta.width ?? 0, meta.height ?? 0);
        const out = region
          ? await sharp(source).rotate().extract(region).png().toBuffer()
          : source;
        return new NextResponse(new Uint8Array(out), {
          headers: {
            'Content-Type': 'image/png',
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
```

(Replace the existing single `return new NextResponse(result.stream, ...)` inside the private-blob branch with the block above.) `/original` requests are unaffected (full image), which the Re-crop modal relies on.

- [ ] **Step 3: Verify** `pnpm typecheck` + `pnpm exec eslint "app/api/admin/images/[cardId]/[type]/route.ts"`.

- [ ] **Step 4: Commit**

```bash
git add "app/api/admin/images/[cardId]/[type]/route.ts"
git commit -m "feat: apply preserve-card crop at serve time in admin image proxy"
```

---

## Task 8: Generalize `ImageCropModal`; rework `AdminBulkUpload` (downscale + coords)

**Files:** `app/(admin)/admin/components/image-crop-modal.tsx`, `app/(admin)/admin/components/admin-bulk-upload.tsx`, `lib/crop-image.ts`, `__tests__/components/admin-bulk-upload.test.tsx`

- [ ] **Step 1: Generalize the modal.** In `image-crop-modal.tsx`, change props from `{ file }` to `{ src, initialCrop?, onSave, onCancel }`:
  - Props interface:
    ```ts
    import type { PixelRect } from '@/lib/crop-image';
    interface ImageCropModalProps {
      src: string;
      initialCrop?: PixelRect;
      onSave: (rect: PixelRect) => void;
      onCancel: () => void;
    }
    ```
  - Remove the internal `URL.createObjectURL(file)` + its revoke effect; use the `src` prop directly for `<img src={src}>`. The caller now owns the URL lifecycle.
  - Seed the crop from `initialCrop`: `const [crop, setCrop] = useState<Crop | undefined>(initialCrop ? { unit: 'px', ...initialCrop } : undefined);` and `const [completed, setCompleted] = useState<PixelCrop | undefined>(initialCrop ? { unit: 'px', ...initialCrop } : undefined);`
  - Keep the Escape + focus effects and `handleSave` (which calls `scaleCropToNatural`).

- [ ] **Step 2: Update `lib/crop-image.ts`** — remove `getCroppedDataUrl` (no longer baking client crops). Keep `scaleCropToNatural` and `PixelRect`.

- [ ] **Step 3: Rework `admin-bulk-upload.tsx`:**
  - Imports: drop `getCroppedDataUrl`; add `import { downscaleToDataUrl } from '@/lib/downscale-image';` and `import { scaleRect } from '@/lib/crop-region';` and keep `type PixelRect` from `@/lib/crop-image`.
  - In `handleCreate`, replace the per-file body that produced `base64` with:
    ```ts
        const item = items[i];
        const { dataUrl, scale } = await downscaleToDataUrl(item.file, 2048);
        const cropData = item.crop ? scaleRect(item.crop, scale) : undefined;
        const label = useFilenameLabels ? item.label : '';
        const skipLabeling = useFilenameLabels && label.length > 0;
        const res = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalImageBase64: dataUrl,
            label,
            skipLabeling,
            skipIllustration,
            cropData,
          }),
        });
    ```
  - Update the modal usage to pass `src` (the item's existing `previewUrl`) and `initialCrop`:
    ```tsx
      {cropIndex !== null && items[cropIndex] && (
        <ImageCropModal
          src={items[cropIndex].previewUrl}
          initialCrop={items[cropIndex].crop}
          onSave={saveCrop}
          onCancel={() => setCropIndex(null)}
        />
      )}
    ```
  - `FileItem.crop` stays `PixelRect` (full-res natural px of the previewed file). Everything else (grid, badges, status) unchanged.

- [ ] **Step 4: Update the component test** `__tests__/components/admin-bulk-upload.test.tsx`: the existing `vi.mock('@/app/(admin)/admin/components/image-crop-modal', ...)` already stubs the modal, so the prop change is transparent. Run it and confirm the existing tests still pass (no new test needed here; behavior covered by helper + API tests).

Run: `pnpm exec vitest run __tests__/components/admin-bulk-upload.test.tsx`

- [ ] **Step 5: Verify** `pnpm typecheck` (confirm no references to the removed `getCroppedDataUrl` remain) + `pnpm exec eslint` on both component files.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/components/image-crop-modal.tsx" "app/(admin)/admin/components/admin-bulk-upload.tsx" lib/crop-image.ts __tests__/components/admin-bulk-upload.test.tsx
git commit -m "refactor: coords-based crop — generalize modal, downscale + send full original"
```

---

## Task 9: `RecropButton` + wire into admin card page

**Files:** `app/(admin)/admin/components/recrop-button.tsx` (new), `app/(admin)/admin/cards/[id]/page.tsx`, `__tests__/components/recrop-button.test.tsx` (new)

- [ ] **Step 1: Write a failing render test** `__tests__/components/recrop-button.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecropButton } from '@/app/(admin)/admin/components/recrop-button';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/(admin)/admin/components/image-crop-modal', () => ({ ImageCropModal: () => null }));

describe('RecropButton', () => {
  it('renders a Re-crop button', () => {
    render(<RecropButton cardId="c1" boardId="b1" initialCrop={null} />);
    expect(screen.getByRole('button', { name: /re-crop/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `app/(admin)/admin/components/recrop-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageCropModal } from './image-crop-modal';
import type { PixelRect } from '@/lib/crop-image';

interface RecropButtonProps {
  cardId: string;
  boardId: string;
  initialCrop: PixelRect | null;
}

export function RecropButton({ cardId, boardId, initialCrop }: RecropButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(rect: PixelRect) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/cards`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, cropData: rect }),
      });
      if (!res.ok) throw new Error('Failed to save crop');
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save crop');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={saving}
        className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        {saving ? 'Saving…' : 'Re-crop'}
      </button>
      {error && (
        <span role="alert" className="ml-2 text-sm text-primary">
          {error}
        </span>
      )}
      {open && (
        <ImageCropModal
          src={`/api/admin/images/${cardId}/original`}
          initialCrop={initialCrop ?? undefined}
          onSave={handleSave}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Wire into the card page.** In `app/(admin)/admin/cards/[id]/page.tsx`:
  - Import: `import { RecropButton } from '../../components/recrop-button';`
  - Where `RegenerateButton` is rendered (around line 64), add the Re-crop button for preserve cards. Adjacent to the existing `{card.originalImageUrl && <RegenerateButton cardId={card.id} />}`:
    ```tsx
    {card.preserveOriginal && card.originalImageUrl && (
      <RecropButton cardId={card.id} boardId={card.boardId} initialCrop={card.cropData ?? null} />
    )}
    ```
  - `card.preserveOriginal`, `card.boardId`, and `card.cropData` are all on the card row the page already queries.

- [ ] **Step 5: Run the test — expect PASS.** Then `pnpm typecheck` + `pnpm exec eslint` on the new component and the page.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/components/recrop-button.tsx" "app/(admin)/admin/cards/[id]/page.tsx" __tests__/components/recrop-button.test.tsx
git commit -m "feat: Re-crop button on admin card page for preserve cards"
```

---

## Task 10: Full verification

- [ ] **Step 1:** `pnpm typecheck` — only pre-existing `e2e/`/`scripts/` errors remain.
- [ ] **Step 2:** `pnpm exec vitest run __tests__ --exclude '**/.claude/**'` — all pass.
- [ ] **Step 3:** Lint all changed files:
```bash
pnpm exec eslint lib/crop-region.ts lib/downscale-image.ts lib/crop-image.ts lib/validations.ts lib/inngest/events.ts lib/inngest/functions/generate-card-artwork.ts "app/api/boards/[boardId]/cards/route.ts" "app/api/images/[...path]/route.ts" "app/api/admin/images/[cardId]/[type]/route.ts" "app/(admin)/admin/components/image-crop-modal.tsx" "app/(admin)/admin/components/admin-bulk-upload.tsx" "app/(admin)/admin/components/recrop-button.tsx" "app/(admin)/admin/cards/[id]/page.tsx"
```
- [ ] **Step 4:** If lint/format changed anything: `git add -A && git commit -m "chore: lint/format editable crop" || echo "nothing to commit"`

---

## Self-Review Notes

- **Spec coverage:** schema+migration (T1), helpers (T2), validation (T3), event+AI crop (T4), route persist/propagate (T5), consumer proxy crop (T6), admin proxy crop (T7), modal generalize + bulk rework + remove getCroppedDataUrl (T8), RecropButton + page (T9), verification (T10).
- **Coordinate-space consistency:** bulk scales the full-res modal crop by the downscale factor (`scaleRect`) so stored `cropData` matches the downscaled blob; re-crop runs on the already-downscaled stored original (no scaling). Proxy + AI both extract against that same stored blob.
- **Type consistency:** `CropData` (db) ↔ `cropDataSchema` (zod) ↔ event field ↔ `PixelRect` (client) all use `{x,y,width,height}`. `cropExtractRegion`/`scaleRect`/`extractCrop` signatures match their call sites.
- **Safety:** crop gated to admins on POST/PATCH; proxy crop gated by `preserveOriginal` so AI cards are never serve-cropped; `cropExtractRegion` returns null on degenerate rects → full image, no 500.
