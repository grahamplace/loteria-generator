# Admin — Editable Crop After Upload — Design

**Date:** 2026-06-19
**Status:** Approved
**Builds on (stacked branch):** `feat/admin-cropped-photo-board` (PR #37). This PR targets that branch.

## Overview

Make a preserve-mode card's crop **editable after the board is created**. Store the full
(downscaled) original plus a `cropData` rectangle on the card; the image proxy applies the
crop at serve time with `sharp.extract()`. Because the on-screen grid and the PDF export
both load card images through the proxy, edits propagate everywhere with **no re-upload** —
re-cropping is just updating coordinates (lossless). A "Re-crop" action on the admin card
page reopens the cropper at the saved rectangle.

This reworks PR #37's preserve flow: the client stops baking the crop into the uploaded
image and instead uploads the full (downscaled) original + crop coordinates. Net result is
a simpler client (no canvas crop on upload).

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Storage model | Coordinates + serve-time crop (full original retained, lossless edits) |
| Re-croppable cards | Preserve-mode cards only (AI cards use the existing Regenerate) |
| Large originals | Client downscales to max 2048px (longest side) before upload |
| Preserve marker | **Explicit `preserveOriginal` boolean column** on `cards` |
| Branch | Stacked on `feat/admin-cropped-photo-board` |

## Data Model

Two new columns on `cards` (`db/schema.ts`), one migration (`pnpm db:generate` →
`0008_*.sql` → `db:migrate`, following the `riddle`/`is_default` precedents):

- `preserveOriginal: boolean('preserve_original').notNull().default(false)` — true for cards
  whose face is the uploaded photo (no AI illustration). Set at card creation from the
  request's effective `skipIllustration`.
- `cropData: json('crop_data').$type<CropData>()` — nullable. `CropData = { x, y, width, height }`
  in **pixels of the stored (downscaled) original**. Null = no crop (serve the full image).

`CropData` interface declared near the existing `BoardStyleOptions` (`db/schema.ts:70`).

## Serve-Time Crop (both image proxies)

Applies to `/api/images/[...path]/route.ts` (consumer) and
`/api/admin/images/[cardId]/[type]/route.ts` (admin).

- **Trigger:** `type === 'illustration'` AND `card.preserveOriginal` AND `card.cropData != null`.
- **Action:** run `sharp.extract({ left, top, width, height })` (clamped to the source image's
  real dimensions — see `cropExtractRegion` helper) before the existing optional `?w=` resize.
  When cropping with no `?w=`, still route through sharp (re-encode) instead of streaming raw.
- **Cache:** the ETag string gains a crop signature (e.g. `-crop{x}-{y}-{w}-{h}`) so editing
  the crop busts the revalidation cache. Existing `Cache-Control: private, no-cache` is kept.
- `/original` (and any non-illustration type) **always serves the full, uncropped image** —
  the re-crop cropper depends on this.
- Invalid/out-of-bounds crop → `cropExtractRegion` clamps; if the result is degenerate, skip
  the extract and serve the full image (never 500 on a bad crop).

## Upload Flow (reworked, both modes)

Client (`AdminBulkUpload`):

- **Downscale:** when a selected image's longest side > 2048px, downscale via canvas to a max
  of 2048px; that downscaled image is the uploaded original. Crop coordinates are chosen on
  this same downscaled image, so coordinate spaces always match the stored blob.
  New helper `lib/downscale-image.ts`: `computeDownscaleDimensions(w, h, max)` (pure,
  unit-tested) + `downscaleToDataUrl(file, max)` (canvas, browser-verified).
- The client no longer renders a cropped canvas for upload. It sends the **full (downscaled)
  original** as `originalImageBase64` plus `cropData` (from the crop modal, in downscaled px;
  `undefined` if uncropped).
- POST body: `{ originalImageBase64, label, skipLabeling, skipIllustration, cropData }`.

Server (`POST /api/boards/[boardId]/cards`):

- Compute `skipIllustration` as today (admin-gated). Insert the card with
  `preserveOriginal: skipIllustration` and `cropData: cropData ?? null` (admin-gated:
  `cropData` honored only when `isAdmin`).
- Pass `cropData` into the `cardGenerateRequested` event.

Inngest (`generate-card-artwork`):

- **Preserve branch (`skipIllustration`):** unchanged — sets `illustrationUrl = originalImageUrl`.
  Serve-time crop handles display.
- **AI branch:** if `cropData` is present, `sharp.extract(cropExtractRegion(cropData, …))` the
  fetched original before `normalizeImageForOpenAI` + OpenAI (server-side crop, since the
  client no longer pre-crops). `cropData` persisted on an AI card is inert (the proxy trigger
  requires `preserveOriginal`, which AI cards don't have).

## Re-Crop UI (admin card page)

- **Generalize `ImageCropModal`** from `{ file }` to `{ src, initialCrop?, onSave, onCancel }`.
  The bulk grid passes its existing per-item object URL; re-crop passes the proxy URL. The
  caller owns the object-URL lifecycle (bulk component already does). `initialCrop` seeds
  `react-image-crop` so the saved rectangle is restored.
- **New `RecropButton`** (client) on `app/(admin)/admin/cards/[id]/page.tsx`, beside
  `RegenerateButton`. Rendered **only when `card.preserveOriginal`** and `card.originalImageUrl`
  exists. It:
  1. opens the modal with `src = /api/admin/images/{cardId}/original` (full image) and
     `initialCrop` derived from `card.cropData`;
  2. on save, `PATCH /api/boards/{boardId}/cards` with `{ cardId, cropData }`;
  3. `router.refresh()` so the cropped illustration re-renders.

The card page is a server component; `RecropButton` is its client child (mirrors
`RegenerateButton`). `card.boardId` is available on the page.

## Validation & PATCH

- `lib/validations.ts`: a shared `cropDataSchema = z.object({ x, y, width, height }).` (all
  `z.number()`), added as optional to `createCardSchema` and as `nullish` to `updateCardSchema`.
- `PATCH /api/boards/[boardId]/cards`: accept `cropData`; when present, set
  `updateData.cropData = cropData`. Existing ownership check and `invalidateBoardPreview` apply.
  No blob work — the proxy reflects the new crop on next fetch (ETag busts).

## Pure Helpers (testable seams)

- `lib/downscale-image.ts` → `computeDownscaleDimensions(w, h, max): { width, height }` — scales
  the longest side down to `max`, preserves aspect, rounds, never upscales.
- `lib/crop-region.ts` → `cropExtractRegion(crop, imgW, imgH): { left, top, width, height } | null`
  — clamps a crop rect to image bounds; returns `null` if degenerate (caller serves full image).
- `lib/crop-image.ts`: keep `scaleCropToNatural`; **remove `getCroppedDataUrl`** (client no
  longer bakes crops).

## Files

- `db/schema.ts` (+`preserveOriginal`, +`cropData`, +`CropData`), `db/migrations/0008_*.sql` (generated)
- `lib/validations.ts` (`cropDataSchema` on create + update)
- `lib/inngest/events.ts` (+`cropData`)
- `lib/inngest/functions/generate-card-artwork.ts` (AI branch crops source)
- `app/api/boards/[boardId]/cards/route.ts` (POST persist `preserveOriginal`+`cropData`, propagate; PATCH persist `cropData`)
- `app/api/images/[...path]/route.ts` + `app/api/admin/images/[cardId]/[type]/route.ts` (serve-time crop)
- `app/(admin)/admin/components/image-crop-modal.tsx` (generalize to `src` + `initialCrop`)
- `app/(admin)/admin/components/admin-bulk-upload.tsx` (downscale; send full original + `cropData`; pass `src`)
- `app/(admin)/admin/cards/[id]/page.tsx` (+`RecropButton`)
- `app/(admin)/admin/components/recrop-button.tsx` (new)
- `lib/downscale-image.ts` (new), `lib/crop-region.ts` (new)
- `lib/crop-image.ts` (remove `getCroppedDataUrl`)

## Edge Cases

- **Pre-existing preserve cards** (created on PR #37 before this change) baked the crop into the
  stored image and have `preserveOriginal=false`/no `cropData` → no Re-crop button. Only cards
  created after this change are editable. Acceptable; noted.
- **Uncropped preserve card:** `cropData=null` → proxy serves full image; Re-crop button still
  shows (lets admin add a crop later) because it gates on `preserveOriginal`, not on `cropData`.
- **Bad/out-of-bounds crop:** clamped by `cropExtractRegion`; degenerate → full image, no 500.
- **AI card with stored `cropData`:** inert at serve time (trigger requires `preserveOriginal`).
- **Regenerate on a preserve card:** out of scope (Regenerate targets AI cards).

## Testing

- **Unit (pure):** `computeDownscaleDimensions` (downscale only, aspect, rounding, no upscale);
  `cropExtractRegion` (clamp, degenerate→null).
- **Validation:** `createCardSchema`/`updateCardSchema` accept `cropData`; reject malformed.
- **API:** POST inserts `preserveOriginal` from `skipIllustration` and persists `cropData`
  (admin) / ignores for non-admin; POST event carries `cropData`; PATCH persists `cropData`.
- **Inngest:** AI branch calls `sharp.extract` (via a mocked crop seam) when `cropData` present;
  preserve branch unchanged.
- **Component:** `RecropButton` renders only for `preserveOriginal` cards.
- **Browser-verified (not unit):** the sharp serve-time crop pipeline and the canvas downscale.

Test runner: Vitest (`pnpm exec vitest run __tests__ --exclude '**/.claude/**'`). DB change is a
generated migration; run `pnpm db:generate` then `pnpm db:migrate` against the dev database.
