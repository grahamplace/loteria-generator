# Admin Bulk Board Builder — Design

**Date:** 2026-06-18
**Status:** Approved

## Overview

An admin-only tool, surfaced on `/admin/boards`, that lets an admin bulk-upload many
photos at once and create a single Loteria board from them. A toggle (default **ON**)
makes each card's label come from the **uploaded file's name, minus its extension**,
instead of the AI labeling process. The AI **illustration** step always runs.

The board is owned by the admin's own account and bypasses the consumer card/generation
limits. The feature reuses the existing consumer API paths (`POST /api/boards` and
`POST /api/boards/[boardId]/cards`) with small, explicit admin-gated branches
(Approach A from brainstorming).

## Goals

- Admin can create a board and upload an arbitrary number of photos in one batch.
- When filename-labeling is ON, each card's label is the filename (sans extension);
  the AI label step is skipped, but the AI illustration is still generated.
- When filename-labeling is OFF, behavior is identical to a consumer upload (AI labels).
- No change to consumer behavior on the shared routes.

## Non-Goals

- Creating boards on behalf of other users (admin's own account only).
- Bulk label editing UI after the fact (existing per-card edit already exists).
- Changing the illustration pipeline or prompts.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Illustration in filename mode | Still generate AI illustration; skip only the AI **label** |
| Board ownership | Admin's own account |
| Limits | Bypass all (card cap, generation cap); board created unlocked |
| Entry point | On the existing `/admin/boards` page |
| API architecture | Approach A — reuse consumer routes with admin-gated branches |
| Toggle default | ON |
| Post-create destination | `/admin/boards/[id]` (existing realtime admin board detail) |

## Architecture

### Filename → label helper

New pure function `filenameToLabel(filename: string): string` in `lib/filename-label.ts`:

- Strip the **last** extension only: `"La Dama.v2.PNG"` → `"La Dama.v2"`,
  `"el corazon.jpg"` → `"el corazon"`, `"noext"` → `"noext"`.
- Trim surrounding whitespace.
- Returns `""` for an empty/whitespace-only result.

Unit-tested independently. (Per the requirement, the transform is literal — strip
extension + trim. No underscore/hyphen-to-space rewriting.)

### API: `POST /api/boards` (`app/api/boards/route.ts`)

- Compute `const isAdmin = isAdminEmail(session.user.email)` (import from `@/lib/admin`).
- When `isAdmin`: skip the board-count limit check, and create the board with
  `isUnlocked: true`. Continue to honor the supplied `name`.
- Non-admin path is unchanged.

### API: `POST /api/boards/[boardId]/cards` (`app/api/boards/[boardId]/cards/route.ts`)

- `createCardSchema` gains optional `skipLabeling: z.boolean().optional()`.
- Compute `const isAdmin = isAdminEmail(session.user.email)`.
- `const skipLabeling = isAdmin && parsed.data.skipLabeling === true` — the flag is
  **only honored for admins**; a non-admin sending it is ignored (no behavior change).
- When `isAdmin`: skip the card-count limit check and the AI generation-cap check.
- Card is already inserted with `label: label || ''`; this is unchanged (the filename
  label arrives in `label`).
- Include `skipLabeling` in the Inngest `cardGenerateRequested` event payload.

### Inngest event (`lib/inngest/events.ts`)

- `cardGenerateRequested` schema gains `skipLabeling: z.boolean().optional()`.

### Inngest function (`lib/inngest/functions/generate-card-artwork.ts`)

- Read `skipLabeling` from `event.data`.
- When `skipLabeling` is true:
  - Skip the `generate-label` step entirely (no OpenAI label call).
  - Resolve the label from the card's existing DB value (the filename label saved at
    insert time) so realtime publishes still carry a label.
  - In `persist-card`, **omit `label`** from the update set so the filename label is
    preserved (set only `illustrationUrl`, `status`, `errorMessage`, `updatedAt`).
- When `skipLabeling` is false/absent: unchanged (AI label + illustration).
- Illustration step, generation counter, realtime publishes, and `onFailure` are
  otherwise unchanged.

### UI: `AdminBulkUpload` component on `/admin/boards`

Client component rendered at the top of the (server) boards page,
`app/(admin)/admin/boards/page.tsx`.

- **Board name** input — default `"Admin Board"`, editable.
- **Toggle** — "Use filename as label (skip AI labeling)", default ON.
- **Multi-file picker** — `<input type="file" multiple accept="image/*">` plus
  drag-and-drop; lists selected files with the live `filenameToLabel` preview each
  will receive.
- **Create board** button:
  1. `POST /api/boards` with `{ name }` → board (admin-created, unlocked).
  2. For each file: read to base64 (`FileReader.readAsDataURL`), derive
     `label = filenameToLabel(file.name)`; `POST /api/boards/[boardId]/cards` with
     `{ originalImageBase64, label, skipLabeling }`. If the toggle is ON but the
     derived label is empty, send `skipLabeling: false` for that file (falls back to
     AI) so we never store a blank-but-skipped label.
  3. On completion, navigate to `/admin/boards/[boardId]`.
- Shows per-file progress; collects per-file failures and displays them without
  aborting the batch.

Follows project UI guidelines (focus-visible, ≥44px touch targets, loading spinner
that keeps its label, `aria-live` for status, theme color classes from `globals.css`).

## Data Flow

```
Admin /admin/boards
  └─ AdminBulkUpload
       ├─ POST /api/boards { name }                         → board (isUnlocked, admin)
       └─ for each file:
            POST /api/boards/[boardId]/cards
              { originalImageBase64, label, skipLabeling }   → card (label set, processing)
                 └─ inngest cardGenerateRequested { ..., skipLabeling }
                      └─ generate-card-artwork
                           ├─ skipLabeling? use DB label (no AI label) : AI label
                           ├─ generate + upload illustration (always)
                           └─ persist-card (omit label when skipLabeling) → completed
  └─ navigate → /admin/boards/[boardId] (realtime progress)
```

## Error Handling & Edge Cases

- **Board create failure** → abort the batch, surface the error to the admin.
- **Per-card upload/AI failure** → existing `status: 'error'` path applies; the admin
  can use the existing **Retry failed** button on `/admin/boards/[boardId]`. The client
  lists which files failed to upload.
- **Empty derived label** with toggle ON → that file is sent `skipLabeling: false`.
- **Non-image files** → rejected client-side (accept filter) and server-side via the
  existing content-type helpers.
- **Non-admin sending `skipLabeling`** → silently ignored; AI labels as normal.

## Testing

- **Unit** (`__tests__/lib/filename-label.test.ts`): extensions, dotted names,
  no-extension, empty/whitespace, trimming, casing of extension.
- **API — `POST /api/boards/[boardId]/cards`**: admin + `skipLabeling` sets `label`
  and emits the Inngest event with `skipLabeling: true`; non-admin + `skipLabeling` is
  ignored; admin bypasses card-count and generation-cap limits; non-admin limits
  unchanged.
- **API — `POST /api/boards`**: admin bypasses board limit and creates `isUnlocked`;
  non-admin limit unchanged.
- **Inngest — `generate-card-artwork`**: `skipLabeling` skips the label generation
  step, preserves the existing label (no overwrite), and still generates the
  illustration.

Test runner: Vitest (`pnpm test`). Tests live in `__tests__/`. Scope test/lint runs to
avoid the stale `.claude/worktrees/` checkout.

## Files Touched

- `lib/filename-label.ts` (new)
- `lib/validations.ts` (`createCardSchema` += `skipLabeling`)
- `lib/inngest/events.ts` (`cardGenerateRequested` += `skipLabeling`)
- `lib/inngest/functions/generate-card-artwork.ts` (skip-label branch)
- `app/api/boards/route.ts` (admin bypass + unlocked)
- `app/api/boards/[boardId]/cards/route.ts` (admin bypass + `skipLabeling` → event)
- `app/(admin)/admin/boards/page.tsx` (render `AdminBulkUpload`)
- `app/(admin)/admin/components/admin-bulk-upload.tsx` (new client component)
- Tests as listed above.
