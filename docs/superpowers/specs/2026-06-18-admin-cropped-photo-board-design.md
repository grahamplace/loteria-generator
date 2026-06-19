# Admin — Create Board from Cropped Photos — Design

**Date:** 2026-06-18
**Status:** Approved
**Builds on:** `2026-06-18-admin-bulk-board-builder-design.md` (the `AdminBulkUpload` tool and the `skipLabeling` flag)

## Overview

Extend the existing admin `AdminBulkUpload` tool (on `/admin/boards`) so an admin can
create a board where uploaded photos are **preserved as-is** (no AI re-illustration),
with an **optional freeform per-image crop** so the card shows the correct part of the
photo. Adds one toggle — **Re-illustrate with AI** (default **OFF**) — and a crop step.
Cropping applies in both modes (preserve and AI).

This reuses the existing `POST /api/boards/[boardId]/cards` → Inngest `generate-card-artwork`
path by adding a new admin-only `skipIllustration` flag, symmetric to the existing
`skipLabeling` flag. No new API routes.

## Goals

- Admin creates a board from photos that become the card faces directly (no AI image).
- Optional per-image freeform crop selects the region used for the card.
- A toggle chooses AI re-illustration vs preserve, independent of the label toggle.
- Cropping applies whether AI re-illustration is on (crop is the AI source) or off
  (crop is the card face).
- No change to consumer behavior on the shared route.

## Non-Goals

- Locking the crop to the 2:3 card ratio (freeform was chosen deliberately).
- Server-side cropping or storing crop coordinates in the DB (cropping is client-side;
  only the resulting image is uploaded).
- Bulk re-crop after board creation, or editing crops from the board page.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Crop ratio | **Freeform** (any rectangle) |
| Crop scope | **Both modes** — cropped image is the source in AI mode, the card face in preserve mode |
| Crop required? | **Optional**; default = the full image |
| Placement | **Extend** the existing `AdminBulkUpload` |
| Crop UI layout | **A** — thumbnail grid; click a photo to open a crop modal |
| Crop library | **`react-image-crop`** (freeform rectangle selection) |
| "Re-illustrate with AI" default | **OFF** (preserve as-is) |

Default workflow becomes **preserve image + filename label = zero AI** (AI toggle OFF +
the existing label toggle ON).

## Architecture

### Toggles

Two checkboxes on `AdminBulkUpload`:

- **Re-illustrate with AI** — default **OFF**. OFF → `skipIllustration: true`.
- **Use filename as label (skip AI labeling)** — existing, default **ON** → `skipLabeling: true`.

All four combinations are valid and handled by the single create path.

### Crop UX (layout A, `react-image-crop`)

- After selecting files, show a **thumbnail grid** (2:3 tiles) of the photos.
- Clicking a tile opens an **`ImageCropModal`** (`react-image-crop`, freeform — no
  `aspect` prop). The admin drags a crop box and clicks **Save crop**; the tile then
  shows a "cropped" badge and stores the completed pixel crop (`PixelCrop`) on its
  `FileItem`. **Cancel** discards.
- Cropping is **optional**: untouched photos use the full image.
- On **Create board**, for each file: if a crop is stored, render the crop region to a
  `<canvas>` and export a base64 data URL (JPEG/PNG); otherwise read the full file as a
  data URL. That base64 is sent as `originalImageBase64`.

`react-image-crop` CSS is imported in the client component
(`import 'react-image-crop/dist/ReactCrop.css'`).

**Freeform → 2:3 display trade-off:** cards render at 2:3 with `object-cover`
(`components/board-card-grid.tsx`) and export draws images into a 2:3 region centered
with padding (`lib/generate-boards.ts`). A non-2:3 crop is therefore center-filled into
the card slot on screen (and letterboxed in export). This is the accepted consequence of
freeform cropping; the modal can show a 2:3 guide overlay as a courtesy but does not
constrain the selection.

### Backend — new `skipIllustration` flag (mirrors `skipLabeling`)

- `lib/validations.ts`: `createCardSchema` gains optional `skipIllustration: z.boolean()`.
- `lib/inngest/events.ts`: `cardGenerateRequested` gains optional `skipIllustration: z.boolean()`.
- `POST /api/boards/[boardId]/cards`: compute
  `const skipIllustration = isAdmin && parsed.data.skipIllustration === true;` and include
  it in the `cardGenerateRequested.create({ ... })` payload (admin-only, exactly like
  `skipLabeling`). Admins already bypass card/generation limits.
- `lib/inngest/functions/generate-card-artwork.ts` — illustration branch:
  - When `skipIllustration`: set the card's `illustrationUrl` to its `originalImageUrl`
    (the uploaded cropped photo) — no `fetchBlob` normalize, no `openai.images.edit`,
    no `uploadIllustration`. Publish the illustration realtime event with that URL.
  - Otherwise: unchanged AI illustration.
  - Guard the `increment-generation-counter` step with `!skipIllustration` (no AI image
    was generated, so the board's `imageGenerationsUsed` must not increment).
  - The label branch is unchanged (AI label, or existing label when `skipLabeling`).

All four combinations flow through the existing single create path. The
preserve+filename case (`skipIllustration` and `skipLabeling` both true) runs a tiny
no-AI Inngest job that loads the existing label and points `illustrationUrl` at
`originalImageUrl` — kept uniform rather than special-cased.

### `illustrationUrl = originalImageUrl` correctness

The image proxy `GET /api/images/[boardId]/[cardId]/[type]` resolves `type=illustration`
by reading `card.illustrationUrl` and fetching that blob. Pointing `illustrationUrl` at
the original blob path therefore serves the cropped photo as the card face, and avoids a
duplicate upload. For preserve cards, the admin debug page will show identical
original/illustration images — expected.

## Data Flow

```
Grid (+ optional ImageCropModal) → per file: cropped|full base64
  → POST /api/boards/[boardId]/cards
       { originalImageBase64, label, skipLabeling, skipIllustration }
     → Inngest generate-card-artwork
        ├─ label:        skipLabeling     ? existing(filename) : AI label
        └─ illustration: skipIllustration ? illustrationUrl = originalImageUrl : AI illustrate
        └─ counter:      increment only when !skipIllustration
     → status 'completed'
  → router.push('/admin/boards/[id]')
```

## Components / Files

- `app/(admin)/admin/components/admin-bulk-upload.tsx` — extended: AI toggle, thumbnail
  grid, per-file crop state, create flow renders cropped base64 and sends
  `skipIllustration`.
- `app/(admin)/admin/components/image-crop-modal.tsx` — new: `react-image-crop` freeform
  modal with Save/Cancel.
- `lib/crop-image.ts` — new: `getCroppedDataUrl(image, crop, mimeType)` (canvas render,
  browser-verified) and `pixelCropFromImage(crop, naturalW, naturalH, displayW, displayH)`
  (pure math, unit-tested).
- `lib/validations.ts` — `createCardSchema` += `skipIllustration`.
- `lib/inngest/events.ts` — `cardGenerateRequested` += `skipIllustration`.
- `app/api/boards/[boardId]/cards/route.ts` — propagate `skipIllustration`.
- `lib/inngest/functions/generate-card-artwork.ts` — `skipIllustration` branch + counter guard.
- `package.json` — add `react-image-crop`.

## Error Handling & Edge Cases

- **Uncropped photo** → full image used.
- **Non-image files** → filtered on selection (existing behavior).
- **Per-card failure** → existing `status: 'error'` path; batch continues; admin can use
  the existing **Retry failed** button. (Note: retry regenerates the AI illustration; for
  preserve cards a failure is unlikely since no AI runs.)
- **Every file fails** → stay on the page with errors visible (existing behavior).
- **Non-admin sending `skipIllustration`** → ignored (flag gated to `isAdminEmail`).
- **Canvas export failure** → mark that file `error` and continue the batch.

## Testing

- **Unit — `lib/crop-image.ts`** (`__tests__/lib/crop-image.test.ts`): `pixelCropFromImage`
  scales a percent/display crop to natural-pixel coordinates correctly (including
  rounding and clamping to image bounds). The canvas `getCroppedDataUrl` is
  browser-verified, not unit-tested (jsdom lacks a real canvas).
- **Unit — `lib/validations.ts`** (`__tests__/lib/validations.test.ts`): `createCardSchema`
  accepts `skipIllustration` boolean; rejects non-boolean; optional.
- **API — `POST /api/boards/[boardId]/cards`** (`__tests__/api/cards-create-admin.test.ts`):
  admin + `skipIllustration: true` emits the event with `skipIllustration: true`;
  non-admin sending it is ignored (falsy in event).
- **Inngest — `generate-card-artwork`** (`__tests__/lib/generate-card-artwork.test.ts`):
  `skipIllustration: true` → `openai.images.edit` not called; `persist-card` sets
  `illustrationUrl` equal to the event's `originalImageUrl`; the generation-counter
  update is not run. AI path (flag false) still calls `images.edit` and increments.
- **Component** (`__tests__/components/admin-bulk-upload.test.tsx`): the
  "Re-illustrate with AI" checkbox is **unchecked** by default (preserve mode).

Test runner: Vitest (`pnpm exec vitest run __tests__ --exclude '**/.claude/**'` to avoid
the stale `.claude/worktrees/` checkout). Typecheck noise in `e2e/`/`scripts/` is
pre-existing.
