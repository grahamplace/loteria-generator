# Default Cards — Design

**Status:** Approved 2026-05-03
**Branch:** `graham/default-cards`

## Problem

54 cards is too many for many users. They want to mix a few of their custom AI-generated cards with some traditional ("classic") Lotería images. Today the only way to add a card is to upload a photo, which triggers async AI generation and counts against the per-board generation limit.

## Goals

1. Let users add traditional Lotería images ("classics" / "default cards") to a board with no upload, no AI work, and no async wait.
2. Make classics visually distinct **in the editor** so users can tell mine vs. classic at a glance.
3. Make the printed/exported board uniform — classics and customs should look like one cohesive set on the final product.
4. Make adding new entries to the default-cards library cheap (drop a webp + add a manifest row) without DB or admin-tooling changes.
5. Ship with **one** classic ("La Rosa") generated from a user-provided source photo, but build the system so adding more is friction-free.

## Non-goals

- Admin UI to manage the default library (deferred — the manifest is code-level)
- Per-user favorites/recents on the picker
- Draggable reordering of classics inside the picker modal
- Translating canonical Spanish card names (proper nouns stay Spanish)
- A separate `default_cards` DB table (a column on `cards` is sufficient)

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Defaults are a **static manifest** in `lib/default-cards.ts` + public webps in `public/default-cards/` | Cheapest path; existing render surfaces already consume URLs |
| 2 | Two new columns on `cards`: `is_default` (bool) and `default_card_id` (text) | Lets us tell types apart for limits/UI/dedup without a join |
| 3 | Adding a classic writes the public URL into `cards.illustration_url` (denormalized) | Existing grid/PDF/preview render paths need zero changes |
| 4 | Defaults **count toward** the card limit (4 free / 54 unlocked) | Preserves unlock incentive; gives free users a real preview |
| 5 | Defaults **do not** increment `image_generations_used` | No AI work happened |
| 6 | One-of-each-classic per board enforced by a **partial unique index** | Hard guarantee against duplicates from concurrent tabs |
| 7 | Visual distinction in editor: **green number badge** for classics (vs. red for custom) | One pixel-cheap change; scales if a third card source is added later |
| 8 | Visual distinction in **printed/exported boards: none** | Final product should feel cohesive |
| 9 | Two entry points: an action-bar "Add classic" button **and** a card-shaped inline tile next to "Add more" | User-requested |
| 10 | A new dedicated endpoint `POST /api/boards/[boardId]/cards/defaults` for bulk-adding classics | Keeps the upload path untouched; narrow purpose |
| 11 | Classic card **labels are user-editable** after add (just like custom card labels) | Matches existing custom-card behavior |

## Architecture

### Data model

New columns on `cards`:

```ts
isDefault: boolean('is_default').notNull().default(false),
defaultCardId: text('default_card_id'), // nullable; FK-style reference to manifest entry id
```

Partial unique index:

```sql
CREATE UNIQUE INDEX cards_board_default_unique
  ON cards (board_id, default_card_id)
  WHERE default_card_id IS NOT NULL;
```

### Manifest

`lib/default-cards.ts`:

```ts
export interface DefaultCard {
  id: string;                // kebab-case, stable forever, e.g. "la-rosa"
  label: string;             // canonical Spanish, e.g. "La Rosa"
  labelEn: string;           // English helper, e.g. "The Rose"
  traditionalNumber?: number; // position in canonical 54-card deck (optional)
  src: string;               // `/default-cards/${id}.webp`
}

export const DEFAULT_CARDS: DefaultCard[] = [
  { id: 'la-rosa', label: 'La Rosa', labelEn: 'The Rose', traditionalNumber: 41, src: '/default-cards/la-rosa.webp' },
];

export const DEFAULT_CARDS_BY_ID = Object.fromEntries(DEFAULT_CARDS.map(c => [c.id, c]));
```

**Immutability rule (documented in the file):** Once a webp is shipped, never delete the file or rename its `id`. Existing user boards have rows pointing at it. New entries can be added freely; existing entries can have their `label`/`labelEn`/`traditionalNumber` updated, but not their `id` or `src`.

Webps live at `public/default-cards/<id>.webp`. Public URL, CDN-cached.

### What gets written when a classic is added

A `cards` row with:

- `originalImageUrl` = `null`
- `illustrationUrl` = `DEFAULT_CARDS_BY_ID[id].src`
- `label` = `DEFAULT_CARDS_BY_ID[id].label` (initial; user-editable after)
- `status` = `'completed'`
- `isDefault` = `true`
- `defaultCardId` = `id`

`imageGenerationsUsed` is **not** incremented. No Inngest event is sent.

## Components

### `components/default-cards-picker.tsx` (new)

A shadcn `Dialog` that lists the manifest as a responsive grid (3-col mobile, 5-col desktop).

Per-cell states:

- **Available:** clickable, hover lifts, "+" affordance
- **Already on board:** ✓ overlay, faded, not clickable, "Already added" tooltip
- **Selected:** outlined in primary, "+" → checkmark

Footer: primary "Add N to board" (disabled if 0 selected), Cancel.

If the user's selection would push them over `maxCards`, the next click no-ops and an inline note appears. For locked free boards at the cap, the existing unlock CTA path takes over (handled at the parent level).

### `components/board-action-bar.tsx` (modify)

Add a second action button next to "Upload photos" — "Add classic", `<Sparkles />` icon, opens the picker. Disabled when at card limit.

### `components/board-card-grid.tsx` (modify)

1. Add a second card-shaped inline tile next to the existing "Add more" tile, with a marigold accent and an `Sparkles` icon, label "ADD CLASSIC". Click opens the picker.
2. In `CardContent`, switch the number badge from `bg-primary` to `bg-accent` when `card.isDefault === true`.
3. Both add tiles only render when `cards.length < maxCards` and the existing unlock CTA does not take precedence.

### `lib/generate-boards.ts` (no change)

The PDF/canvas drawer reads only `card.illustration` and the per-board `styleOptions`. We deliberately do not pass `isDefault` through. Printed boards stay uniform.

## Data flow

```
[User clicks "Add classic"]
   ↓
[DefaultCardsPicker opens; reads DEFAULT_CARDS + current board cards via hook]
   ↓
[User selects N classics → "Add to board"]
   ↓
[useBoardCards.addDefaultCards(ids) — optimistic insert with temp ids]
   ↓
[POST /api/boards/[boardId]/cards/defaults { defaultCardIds }]
   ↓
[Server: auth + board ownership + manifest validation + dedup + limit check]
   ↓
[Single INSERT with COALESCE(MAX(number)) sequencing]
   ↓
[Response: full card rows]
   ↓
[Hook swaps temp ids for server rows; preview invalidated; PostHog event fired]
```

## API

### `POST /api/boards/[boardId]/cards/defaults`

**Request:**
```json
{ "defaultCardIds": ["la-rosa"] }
```

**Validation (`addDefaultCardsSchema`):**
```ts
z.object({ defaultCardIds: z.array(z.string().min(1)).min(1).max(54) })
```

**Errors:**
- 401 — unauthenticated
- 404 — board not found / not owned
- 400 `INVALID_DEFAULT_ID` — any id missing from manifest
- 409 `ALREADY_ADDED` — any id already exists for this board
- 403 `CARD_LIMIT_REACHED` — `existing.length + incoming.length > maxCards`

**Success:**
```json
{ "cards": [/* full card rows */] }
```

**Side effects:**
- Single SQL insert, no Inngest event, no `image_generations_used` increment
- `invalidateBoardPreview(boardId)`
- PostHog: `default_cards_added` `{ count, ids, board_id }`

### `DELETE /api/boards/[boardId]/cards/[cardId]` (modify)

Skip `deleteCardImages` blob cleanup when the card is a default. The webp is shared/public — only customs have private blob assets to clean up.

Guard: only run blob cleanup when `originalImageUrl || (illustrationUrl && !isDefault)`.

## Hooks

`hooks/use-board-cards.ts` — add `addDefaultCards(ids: string[])`. Same optimistic-insert pattern as `addCards(files)` but writing complete cards (status='completed', illustration URL known up-front) instead of placeholder pending cards.

## Validation

`lib/validations.ts` — add:

```ts
export const addDefaultCardsSchema = z.object({
  defaultCardIds: z.array(z.string().min(1)).min(1).max(54),
});
```

## i18n

New translation keys (per project memory: a subagent reviews the Spanish before merge):

- `BoardEditor.ActionBar.addClassic`
- `BoardEditor.ActionBar.addClassicDisabled`
- `BoardEditor.CardGrid.addClassicTile`
- `BoardEditor.DefaultCardsPicker.title`
- `BoardEditor.DefaultCardsPicker.subtitle`
- `BoardEditor.DefaultCardsPicker.addButton` (with `{count}`)
- `BoardEditor.DefaultCardsPicker.alreadyAdded`
- `BoardEditor.DefaultCardsPicker.cardLimitNote`
- `BoardEditor.DefaultCardsPicker.empty`
- `BoardEditor.DefaultCardsPicker.cancel`

In `messages/en.json` and `messages/es.json`. Default card labels themselves stay Spanish-canonical and are not translated.

## La Rosa generation

The user supplied a rose source photo at:
`/Users/grahamplace/Library/Application Support/CleanShot/media/media_XvvrVwZJFa/CleanShot 2026-05-03 at 12.10.20.png`

Pipeline (one-off for this PR; reuses the existing `pnpm generate:examples` infrastructure):

1. Copy source to `scripts/example-images/source-photos/la-rosa.jpg` (re-encoded from PNG)
2. Run the existing `gpt-image-1.5` pipeline using the production `ILLUSTRATION_PROMPT` from `lib/illustration-prompt.ts`
3. Output PNG → `scripts/example-images/illustrations/la-rosa.png`
4. `cwebp -q 85 -resize 600 900 ... -o public/default-cards/la-rosa.webp`
5. Manually inspect; regenerate if quality is off
6. Commit the source photo, output PNG, and webp; add manifest row

A parallel `pnpm generate:default-cards` task that mirrors `pnpm generate:examples` is **planned but deferred** — adding additional classics in follow-up PRs can use the existing example-images script with the output redirected.

## Edge cases

| Case | Behavior |
|---|---|
| Locale=en, board has classics | Card displays canonical Spanish "La Rosa". Picker can show `labelEn` as helper text. |
| User edits classic label, deletes, re-adds | Re-adds with canonical label; deletion is real. |
| Manifest entry removed in code while users have it | Existing rows still render via denormalized URL — but **never delete the webp file**. |
| Free user at 4 cards (any mix) | Existing unlock CTA path triggers normally. |
| Concurrent add of same classic from two tabs | Partial unique index → second request returns 409 `ALREADY_ADDED`. |
| Public webp hotlinked elsewhere | Acceptable; favicons, hero illustrations are already public. |
| Image fails to load | `<Image>` shows broken state. Mitigation: verify webp exists at manifest commit time. |

## Testing

- `__tests__/lib/default-cards.test.ts` — manifest sanity (ids unique, kebab-case, every `src` resolves to a file in `public/default-cards/`)
- `__tests__/api/default-cards.test.ts` — happy path, dedup 409, limit 403, invalid id 400, free vs. unlocked card cap, ownership 404
- Existing card-grid tests get a case asserting badge color when `isDefault=true`
- Manual: add classic on free tier, hit limit, unlock, mix custom + classic, remove and re-add, export PDF and confirm no per-card visual difference

## Tracking

PostHog event: `default_cards_added` with `{ count, ids: string[], board_id }`. Existing `card_label_edited` covers post-add label edits.

## Out of scope (follow-ups)

- Generator script split (`pnpm generate:default-cards`)
- Admin UI for the default library
- Bulk seeding the canonical 54-card deck
- Per-user favorites/recents on the picker
- Multi-locale card labels
