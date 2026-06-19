# Admin Cropped-Photo Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the admin `AdminBulkUpload` tool so photos can be preserved as-is (no AI re-illustration) with an optional freeform per-image crop, via a new admin-only `skipIllustration` flag symmetric to the existing `skipLabeling`.

**Architecture:** Cropping is client-side (`react-image-crop` → canvas). All create paths reuse `POST /api/boards/[boardId]/cards` → Inngest `generate-card-artwork`. A new `skipIllustration` flag (gated to admins) makes the Inngest illustration branch set `illustrationUrl = originalImageUrl` (the uploaded cropped photo) instead of calling the AI, and skips the image-generation counter.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle/Neon, Inngest, Vitest, React 19, Tailwind v4, `react-image-crop`.

**Test commands:** Run scoped to avoid the stale worktree, e.g. `pnpm exec vitest run __tests__/lib/crop-image.test.ts`. Final: `pnpm typecheck` and `pnpm exec vitest run __tests__ --exclude '**/.claude/**'`.

---

## Task 1: Add the `react-image-crop` dependency

**Files:** `package.json`, lockfile

- [ ] **Step 1: Install**

Run: `pnpm add react-image-crop`
Expected: `react-image-crop` added to `dependencies`.

- [ ] **Step 2: Verify it resolves**

Run: `node -e "require.resolve('react-image-crop'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add react-image-crop dependency"
```

---

## Task 2: `lib/crop-image.ts` — crop math + canvas helper

**Files:**
- Create: `lib/crop-image.ts`
- Test: `__tests__/lib/crop-image.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/crop-image.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scaleCropToNatural } from '@/lib/crop-image';

describe('scaleCropToNatural', () => {
  it('scales a display-pixel crop up to natural pixels', () => {
    // image displayed at 200x300 but natural 1000x1500 (5x)
    const rect = scaleCropToNatural(
      { x: 20, y: 30, width: 100, height: 150 },
      { naturalWidth: 1000, naturalHeight: 1500, displayWidth: 200, displayHeight: 300 }
    );
    expect(rect).toEqual({ x: 100, y: 150, width: 500, height: 750 });
  });

  it('is identity when display equals natural', () => {
    const rect = scaleCropToNatural(
      { x: 10, y: 10, width: 40, height: 60 },
      { naturalWidth: 100, naturalHeight: 100, displayWidth: 100, displayHeight: 100 }
    );
    expect(rect).toEqual({ x: 10, y: 10, width: 40, height: 60 });
  });

  it('rounds fractional results', () => {
    const rect = scaleCropToNatural(
      { x: 1, y: 1, width: 33, height: 33 },
      { naturalWidth: 333, naturalHeight: 333, displayWidth: 100, displayHeight: 100 }
    );
    // 33 * 3.33 = 109.89 -> 110
    expect(rect.width).toBe(110);
    expect(rect.height).toBe(110);
  });

  it('clamps width/height so the rect stays within the image', () => {
    const rect = scaleCropToNatural(
      { x: 90, y: 90, width: 50, height: 50 },
      { naturalWidth: 100, naturalHeight: 100, displayWidth: 100, displayHeight: 100 }
    );
    expect(rect.x).toBe(90);
    expect(rect.width).toBe(10);
    expect(rect.height).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/lib/crop-image.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

Create `lib/crop-image.ts`:

```ts
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageDims {
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
}

/**
 * Convert a crop expressed in the rendered (display) pixel space of an <img>
 * into the image's natural pixel space, rounding and clamping so the rect stays
 * within the image bounds. Pure — unit-tested.
 */
export function scaleCropToNatural(
  crop: { x: number; y: number; width: number; height: number },
  dims: ImageDims
): PixelRect {
  const scaleX = dims.naturalWidth / dims.displayWidth;
  const scaleY = dims.naturalHeight / dims.displayHeight;
  const x = Math.max(0, Math.round(crop.x * scaleX));
  const y = Math.max(0, Math.round(crop.y * scaleY));
  const width = Math.min(dims.naturalWidth - x, Math.round(crop.width * scaleX));
  const height = Math.min(dims.naturalHeight - y, Math.round(crop.height * scaleY));
  return { x, y, width, height };
}

/**
 * Render a natural-pixel crop rect of a File to a JPEG data URL via canvas.
 * Browser-only (uses createImageBitmap + canvas) — verified manually, not unit
 * tested (jsdom has no real canvas).
 */
export async function getCroppedDataUrl(
  file: File,
  rect: PixelRect,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  bitmap.close?.();
  return canvas.toDataURL(mimeType, 0.92);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run __tests__/lib/crop-image.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/crop-image.ts __tests__/lib/crop-image.test.ts
git commit -m "feat: add crop-image helpers (scaleCropToNatural + getCroppedDataUrl)"
```

---

## Task 3: Add `skipIllustration` to `createCardSchema`

**Files:**
- Modify: `lib/validations.ts`
- Test: `__tests__/lib/validations.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/validations.test.ts` (reuse the existing `createCardSchema` import; add it to the existing import line only if missing):

```ts
describe('createCardSchema skipIllustration', () => {
  it('accepts skipIllustration true', () => {
    const parsed = createCardSchema.safeParse({ label: 'El Sol', skipIllustration: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.skipIllustration).toBe(true);
  });

  it('is optional', () => {
    expect(createCardSchema.safeParse({ label: 'El Sol' }).success).toBe(true);
  });

  it('rejects non-boolean skipIllustration', () => {
    expect(createCardSchema.safeParse({ skipIllustration: 'yes' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/lib/validations.test.ts`
Expected: FAIL — `skipIllustration` stripped / non-boolean accepted.

- [ ] **Step 3: Write the implementation**

In `lib/validations.ts`, add to `createCardSchema` (which currently has `originalImageBase64`, `label`, `skipLabeling`):

```ts
  // Admin-only: when true, preserve the uploaded image as the card face and
  // skip AI illustration. Ignored for non-admins.
  skipIllustration: z.boolean().optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run __tests__/lib/validations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validations.ts __tests__/lib/validations.test.ts
git commit -m "feat: add skipIllustration to createCardSchema"
```

---

## Task 4: `skipIllustration` in the Inngest event + `generate-card-artwork`

**Files:**
- Modify: `lib/inngest/events.ts`
- Modify: `lib/inngest/functions/generate-card-artwork.ts`
- Test: `__tests__/lib/generate-card-artwork.test.ts`

- [ ] **Step 1: Write the failing test**

Append a new `describe` block to `__tests__/lib/generate-card-artwork.test.ts` (the file already mocks everything and exposes `captured.handler`, `updateSetSpy`, `cardsFindFirst`, `chatCreate`, `imagesEdit`, `makeStep`, `persistCall`, `CARD`, `BOARD`):

```ts
describe('generate-card-artwork skipIllustration', () => {
  it('preserves the original image as the card face and skips AI illustration + counter', async () => {
    chatCreate.mockResolvedValue({ choices: [{ message: { content: 'La Luna' } }] });
    const { runNames, step } = makeStep();

    await captured.handler!({
      event: {
        data: {
          cardId: CARD,
          boardId: BOARD,
          userId: 'u1',
          originalImageUrl: 'https://blob/o.png',
          skipIllustration: true,
        },
      },
      step,
    });

    // No AI image call, and the illustration step never ran.
    expect(imagesEdit).not.toHaveBeenCalled();
    expect(runNames).not.toContain('generate-and-upload-illustration');
    // Card face = the uploaded (cropped) original.
    const persisted = persistCall();
    expect(persisted!.illustrationUrl).toBe('https://blob/o.png');
    // imageGenerationsUsed must NOT be incremented for preserved images.
    const touchedCounter = updateSetSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .some((v) => 'imageGenerationsUsed' in v);
    expect(touchedCounter).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/lib/generate-card-artwork.test.ts`
Expected: FAIL — `imagesEdit` is called and the counter is incremented.

- [ ] **Step 3a: Add `skipIllustration` to the event schema**

In `lib/inngest/events.ts`, add to the `cardGenerateRequested` schema object (after `skipLabeling`):

```ts
    skipIllustration: z.boolean().optional(),
```

- [ ] **Step 3b: Branch the illustration in `generate-card-artwork.ts`**

In `lib/inngest/functions/generate-card-artwork.ts`:

(1) Destructure `skipIllustration` (the line currently destructures `skipLabeling`):

```ts
    const { cardId, boardId, userId, originalImageUrl, skipLabeling, skipIllustration } =
      event.data;
```

(2) Add an early-return branch at the TOP of the `illustrationPromise` IIFE, before the existing `step.run('generate-and-upload-illustration', ...)`:

```ts
    const illustrationPromise = (async () => {
      if (skipIllustration) {
        // Preserve the uploaded (cropped) photo as the card face — no AI.
        await step.realtime.publish('publish-illustration', ch.illustration, {
          illustrationUrl: originalImageUrl,
        });
        return originalImageUrl;
      }

      const illustrationUrl = await step.run('generate-and-upload-illustration', async () => {
        // ... existing AI illustration body UNCHANGED ...
      });
      await step.realtime.publish('publish-illustration', ch.illustration, { illustrationUrl });
      return illustrationUrl;
    })();
```

Do not modify the existing AI body — only wrap it with the `if (skipIllustration) {...}` early return above it.

(3) Guard the generation counter so it only runs when an AI image was actually generated. Wrap the existing `increment-generation-counter` step:

```ts
    if (!skipIllustration) {
      await step.run('increment-generation-counter', async () => {
        await db
          .update(boards)
          .set({
            imageGenerationsUsed: sql`${boards.imageGenerationsUsed} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(boards.id, boardId));
      });
    }
```

Leave `persist-card` as-is — it already writes `illustrationUrl` (which is now `originalImageUrl` when preserving) and `status: 'completed'`. The label branch and `onFailure` are unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run __tests__/lib/generate-card-artwork.test.ts`
Expected: PASS (existing tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add lib/inngest/events.ts lib/inngest/functions/generate-card-artwork.ts __tests__/lib/generate-card-artwork.test.ts
git commit -m "feat: support skipIllustration (preserve image) in card artwork generation"
```

---

## Task 5: Propagate `skipIllustration` in `POST /api/boards/[boardId]/cards`

**Files:**
- Modify: `app/api/boards/[boardId]/cards/route.ts`
- Test: `__tests__/api/cards-create-admin.test.ts`

- [ ] **Step 1: Write the failing test**

Append a new `describe` block to `__tests__/api/cards-create-admin.test.ts` (it already has `ADMIN`, `USER`, `IMG`, `params`, `makeReq`, `boardsFindFirst`, `sendMock`, and the `beforeEach`):

```ts
describe('POST /api/boards/[boardId]/cards admin skipIllustration', () => {
  it('admin: sends event with skipIllustration true', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    boardsFindFirst.mockResolvedValue({ id: 'board-1', userId: 'admin-1', isUnlocked: true, imageGenerationsUsed: 0 });

    const res = await POST(
      makeReq({ originalImageBase64: IMG, label: 'El Perro', skipIllustration: true }),
      { params }
    );
    expect(res.status).toBe(201);
    expect(sendMock.mock.calls[0][0].data.skipIllustration).toBe(true);
  });

  it('non-admin: skipIllustration is ignored in the emitted event', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    boardsFindFirst.mockResolvedValue({ id: 'board-1', userId: 'user-1', isUnlocked: false, imageGenerationsUsed: 0 });

    const res = await POST(
      makeReq({ originalImageBase64: IMG, label: 'El Perro', skipIllustration: true }),
      { params }
    );
    expect(res.status).toBe(201);
    expect(sendMock.mock.calls[0][0].data.skipIllustration).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/api/cards-create-admin.test.ts`
Expected: FAIL — event lacks `skipIllustration`.

- [ ] **Step 3: Write the implementation**

In `app/api/boards/[boardId]/cards/route.ts`:

(1) Where `skipLabeling` is computed (just after `const isAdmin = isAdminEmail(session.user.email);`), add:

```ts
    const skipIllustration = isAdmin && parsed.data.skipIllustration === true;
```

(2) Add `skipIllustration` to the `cardGenerateRequested.create({ ... })` payload (alongside `skipLabeling`):

```ts
            cardGenerateRequested.create({
              cardId: newCard.id,
              boardId,
              userId: session.user.id,
              originalImageUrl: originalUrl,
              skipLabeling,
              skipIllustration,
            })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run __tests__/api/cards-create-admin.test.ts`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add "app/api/boards/[boardId]/cards/route.ts" __tests__/api/cards-create-admin.test.ts
git commit -m "feat: propagate skipIllustration from card create route to inngest"
```

---

## Task 6: `ImageCropModal` component

**Files:**
- Create: `app/(admin)/admin/components/image-crop-modal.tsx`

(No unit test — `react-image-crop` + canvas are browser-verified; the pure math is covered in Task 2. Verified via typecheck and the app.)

- [ ] **Step 1: Create the component**

Create `app/(admin)/admin/components/image-crop-modal.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { scaleCropToNatural, type PixelRect } from '@/lib/crop-image';

interface ImageCropModalProps {
  file: File;
  onSave: (rect: PixelRect) => void;
  onCancel: () => void;
}

export function ImageCropModal({ file, onSave, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [src] = useState(() => URL.createObjectURL(file));

  useEffect(() => {
    return () => URL.revokeObjectURL(src);
  }, [src]);

  function handleSave() {
    const img = imgRef.current;
    if (!img || !completed || completed.width === 0 || completed.height === 0) {
      onCancel();
      return;
    }
    const rect = scaleCropToNatural(
      { x: completed.x, y: completed.y, width: completed.width, height: completed.height },
      {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: img.width,
        displayHeight: img.height,
      }
    );
    onSave(rect);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div className="max-h-[90vh] max-w-2xl overflow-auto rounded-lg bg-background p-4 shadow-lg">
        <h3 className="mb-2 text-base font-semibold text-foreground">Crop image</h3>
        <p className="mb-3 text-sm text-foreground/60">
          Drag to select the part of the photo to use. Cancel to keep the full image.
        </p>
        <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompleted(c)}>
          {/* react-image-crop requires a raw <img> child */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={src} alt="" className="max-h-[60vh] w-auto" />
        </ReactCrop>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            style={{ touchAction: 'manipulation' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-primary"
            style={{ touchAction: 'manipulation' }}
          >
            Save crop
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck` (no NEW errors in this file — pre-existing `e2e/`/`scripts/` errors are fine)
Run: `pnpm exec eslint "app/(admin)/admin/components/image-crop-modal.tsx"`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/components/image-crop-modal.tsx"
git commit -m "feat: add ImageCropModal (react-image-crop freeform cropper)"
```

---

## Task 7: Extend `AdminBulkUpload` — AI toggle, thumbnail grid, crop integration

**Files:**
- Modify: `app/(admin)/admin/components/admin-bulk-upload.tsx`
- Test: `__tests__/components/admin-bulk-upload.test.tsx`

- [ ] **Step 1: Add the failing test**

Append to `__tests__/components/admin-bulk-upload.test.tsx`. First, at the top of the file (after the existing `vi.mock('next/navigation', ...)`), add a mock so the cropper module isn't loaded in jsdom:

```tsx
vi.mock('@/app/(admin)/admin/components/image-crop-modal', () => ({
  ImageCropModal: () => null,
}));
```

Then add this test inside the existing `describe('AdminBulkUpload', ...)`:

```tsx
  it('defaults "Re-illustrate with AI" to OFF (preserve as-is)', () => {
    render(<AdminBulkUpload />);
    const toggle = screen.getByRole('checkbox', { name: /re-illustrate with ai/i });
    expect(toggle).not.toBeChecked();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/components/admin-bulk-upload.test.tsx`
Expected: FAIL — no "Re-illustrate with AI" checkbox yet.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `app/(admin)/admin/components/admin-bulk-upload.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { filenameToLabel } from '@/lib/filename-label';
import { getCroppedDataUrl, type PixelRect } from '@/lib/crop-image';
import { ImageCropModal } from './image-crop-modal';

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

interface FileItem {
  file: File;
  label: string;
  status: FileStatus;
  error?: string;
  crop?: PixelRect;
  previewUrl: string;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const mimeForCrop = (file: File) => (file.type === 'image/png' ? 'image/png' : 'image/jpeg');

export function AdminBulkUpload() {
  const router = useRouter();
  const [name, setName] = useState('Admin Board');
  const [useFilenameLabels, setUseFilenameLabels] = useState(true);
  const [reIllustrate, setReIllustrate] = useState(false);
  const [items, setItems] = useState<FileItem[]>([]);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    setItems((prev) => {
      prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return Array.from(fileList)
        .filter((f) => f.type.startsWith('image/'))
        .map((file) => ({
          file,
          label: filenameToLabel(file.name),
          status: 'pending' as const,
          previewUrl: URL.createObjectURL(file),
        }));
    });
    setError(null);
  }

  function saveCrop(rect: PixelRect) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === cropIndex ? { ...it, crop: rect } : it))
    );
    setCropIndex(null);
  }

  async function handleCreate() {
    if (items.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);

    let boardId: string;
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Admin Board' }),
      });
      if (!res.ok) throw new Error('Failed to create board');
      boardId = (await res.json()).board.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create board');
      setSubmitting(false);
      return;
    }

    const skipIllustration = !reIllustrate;
    let succeeded = 0;
    for (let i = 0; i < items.length; i++) {
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it)));
      try {
        const item = items[i];
        const base64 = item.crop
          ? await getCroppedDataUrl(item.file, item.crop, mimeForCrop(item.file))
          : await readAsDataUrl(item.file);
        const label = useFilenameLabels ? item.label : '';
        // If the toggle is on but the derived label is empty, fall back to AI.
        const skipLabeling = useFilenameLabels && label.length > 0;
        const res = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originalImageBase64: base64, label, skipLabeling, skipIllustration }),
        });
        if (!res.ok) throw new Error('Upload failed');
        succeeded++;
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'done' } : it)));
      } catch (e) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: 'error', error: e instanceof Error ? e.message : 'failed' }
              : it
          )
        );
      }
    }

    if (succeeded > 0) {
      router.push(`/admin/boards/${boardId}`);
      return;
    }
    setError('Every file failed to upload. The board was created but has no cards.');
    setSubmitting(false);
  }

  return (
    <section className="mb-8 rounded-lg border border-foreground/10 bg-background p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Bulk create board</h2>

      <div className="mb-3 flex flex-col gap-1">
        <label htmlFor="bulk-board-name" className="text-sm font-medium text-foreground">
          Board name
        </label>
        <input
          id="bulk-board-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-foreground/20 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary"
          style={{ touchAction: 'manipulation' }}
        />
      </div>

      <label className="mb-2 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={reIllustrate}
          onChange={(e) => setReIllustrate(e.target.checked)}
        />
        Re-illustrate with AI
      </label>

      <label className="mb-3 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={useFilenameLabels}
          onChange={(e) => setUseFilenameLabels(e.target.checked)}
        />
        Use filename as label (skip AI labeling)
      </label>

      <div className="mb-3">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => onFilesSelected(e.target.files)}
          className="block w-full text-sm text-foreground/70 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary/90 file:[touch-action:manipulation]"
        />
      </div>

      {items.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {items.map((it, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCropIndex(idx)}
              className="group relative overflow-hidden rounded-md border border-foreground/10 focus-visible:outline-2 focus-visible:outline-primary"
              style={{ touchAction: 'manipulation' }}
              title={`${it.file.name} — click to crop`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.previewUrl} alt={it.file.name} className="aspect-[2/3] w-full object-cover" />
              {it.crop && (
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  cropped
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
                {useFilenameLabels ? it.label || '(AI label)' : '(AI label)'} · {it.status}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mb-3 text-sm text-primary" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={items.length === 0 || submitting}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        {submitting ? 'Creating…' : 'Create board'}
      </button>

      {cropIndex !== null && items[cropIndex] && (
        <ImageCropModal
          file={items[cropIndex].file}
          onSave={saveCrop}
          onCancel={() => setCropIndex(null)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run __tests__/components/admin-bulk-upload.test.tsx`
Expected: PASS (existing tests + the new "Re-illustrate with AI" default-off test).

- [ ] **Step 5: Verify typecheck + lint**

Run: `pnpm typecheck` (no NEW errors)
Run: `pnpm exec eslint "app/(admin)/admin/components/admin-bulk-upload.tsx"`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/components/admin-bulk-upload.tsx" __tests__/components/admin-bulk-upload.test.tsx
git commit -m "feat: thumbnail grid + per-image crop + AI re-illustrate toggle in bulk upload"
```

---

## Task 8: Full verification

**Files:** none

- [ ] **Step 1: Typecheck** — `pnpm typecheck` (only pre-existing `e2e/`/`scripts/` errors remain)
- [ ] **Step 2: Tests** — `pnpm exec vitest run __tests__ --exclude '**/.claude/**'` (all pass)
- [ ] **Step 3: Lint changed files** —
```bash
pnpm exec eslint lib/crop-image.ts lib/validations.ts lib/inngest/events.ts lib/inngest/functions/generate-card-artwork.ts "app/api/boards/[boardId]/cards/route.ts" "app/(admin)/admin/components/image-crop-modal.tsx" "app/(admin)/admin/components/admin-bulk-upload.tsx"
```
- [ ] **Step 4:** If lint/format changed anything: `git add -A && git commit -m "chore: lint/format cropped-photo board" || echo "nothing to commit"`

---

## Self-Review Notes

- **Spec coverage:** dependency (T1), crop helpers (T2), schema (T3), event+function skipIllustration with counter guard (T4), route propagation (T5), crop modal (T6), grid + AI toggle + crop wiring (T7), verification (T8). All spec sections covered.
- **Type consistency:** `PixelRect` from `lib/crop-image.ts` used by both modal and component; `skipIllustration: boolean` consistent across schema, event, route, function; `scaleCropToNatural` signature matches its call site in the modal.
- **Behavioral checks:** default `reIllustrate=false` → `skipIllustration=true` (preserve) is the default; non-admin `skipIllustration` ignored (T5); counter not incremented when preserving (T4); uncropped → full image (T7).
