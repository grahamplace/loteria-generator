# Board photo split — design

Date: 2026-10-28 · Status: draft for review

## Why

Some users upload a single image of an **entire lotería set** (a printed sheet / grid of cards) instead of one photo per card. Today that image becomes one card whose illustration is a mosaic of 40+ tiny cards (prod example: board `3979513a-…`, card `563983fb-…`, 45 cards in a 9×5 grid). These users already designed a full set, so they are high-intent buyers. We want to detect the sheet, cut it into individual cards, and let the paywall do its job: free boards get the free allowance of cards, plus a clear "unlock to import the whole set" nudge.

## Goals

1. Detect when an uploaded image is a sheet of multiple cards.
2. Split it into individual cards (one card per sheet card, in reading order), each with its own cropped original photo.
3. Read each card's printed title and use it as the card label.
4. Respect limits: never exceed the board's card limit or generation limit. Locked board → only fill the free slots.
5. On a locked board, show a banner telling the user how many cards we found and that unlocking then re-uploading imports the full set.

## Non-goals (v1)

- Reusing the already-uploaded sheet after payment. **Owner decision:** asking the user to upload it again is fine.
- Boards in "original photo" mode (`photoMode === 'original'`). Those uploads finish inside the POST request and never reach the Inngest job. Leave them unsplit in v1 (builder may add later).
- Perspective correction / deskewing of angled phone photos. Axis-aligned crops only; the illustrator redraws anyway.
- Splitting cards that already exist, or an admin "split this card" button.

## Anti-goals (failure even if it "works")

- A normal photo (family, pet, single lotería card) gets split. Use a high detection threshold; any doubt → normal path.
- Normal uploads get slower or less reliable. Detection must not add latency to the upload request, and any failure in the split path falls back to the normal single-card flow.
- A locked board ends up with more than `FREE_CARD_LIMIT` cards or more than its generation allowance.
- Split cards whose illustration contains the printed card number/title baked into the art.

## User experience (owner's description)

1. User uploads the sheet like any photo. The card appears as usual in "processing".
2. When detection fires, a toast: **"Existing lotería set detected, processing…"** The uploaded card shows a special "splitting" state until the split finishes.
3. After the split it's the normal board UI: N regular cards, each processing → illustrated as usual, labels pre-filled from the printed titles.
4. Locked board: a banner, roughly "We found 45 cards in your photo. Unlock this board, then upload it again to import the full set." with the existing unlock CTA. Price via `useUnlockPriceDisplay()` — never hardcoded. Keep copy minimal (AGENTS.md).

All new copy goes in `messages/en.json` and `messages/es-MX.json`. The owner doesn't read Spanish: have a subagent review the es-MX strings.

## Spike findings (2026-10-28)

Throwaway scripts in `.scratch/board-spike/` (untracked; the customer photo is only in the session scratchpad, never commit it). Tested on Claudia's real sheet (1536×1024, 45 cards, ~165×200 px each, titles with Spanish + English subtitles) and a synthetic tilted "phone photo" of 12 classic cards.

| Step | Result |
|---|---|
| Detection — Decisions API, `gpt-6-luna`, one `predicate` question | 13 images: both sheets → 1.0; single classic card, 5 stock photos, 6 tricky prod photos → 0. ~1.6 s each. One call returned `server_error: "Decision inference is unavailable."` → needs retry + fallback. |
| Extraction — Responses API, `gpt-6.1-sol`, strict JSON schema | 45/45 and 12/12 cards, correct rows/cols, tight boxes, every title exact (accents included). 17–28 s. `gpt-5.5` equally accurate, ~2× slower. |
| Illustrate the plain crop | Bakes the printed title into the art. ✗ |
| Illustrate the full sheet + "only the card at row r, col c" | Picked the right card 4/4, clean art, but **one card rejected by the safety system** (the sheet as a whole tripped it; the crop alone passed) and one card loosely reinterpreted. ✗ |
| Illustrate the crop + overlay line "The input is a scanned lotería card. Illustrate only the picture. Do not reproduce the card border, the card number, or any printed title or caption text." | No text, most faithful, passed safety. ✓ |

**Decision: crop each card; illustrate the crop with the extra overlay line.** Cropping is needed regardless — the per-card original photo is used by the "Original Upload" panel, original-photo mode toggle, and recrop.

Spike caveats: small sample. Not tested: a real angled phone photo, a sheet without printed titles, a sheet with partially cut-off cards. Build a small eval set for these (see Testing).

## Architecture

### Where it runs

In the existing Inngest function `lib/inngest/functions/generate-card-artwork.ts`, as new steps **before** label/illustration generation. The upload POST (`app/api/boards/[boardId]/cards/route.ts`) is unchanged, so normal uploads pay no latency.

Skip detection entirely when: `skipIllustration` is set (original mode / admin preserve), or the card was itself created by a split (see `fromSheet` below).

### New module `lib/sheet-split.ts`

Holds model IDs (`SHEET_DETECT_MODEL = 'gpt-6-luna'`, `SHEET_EXTRACT_MODEL = 'gpt-6.1-sol'`), the detection question, the extraction prompt + JSON schema, the illustration overlay line, and pure helpers (slot math, box → `extract` region with clamping). Prompt/schema starting point: `.scratch/board-spike/detect-extract.ts`. Wrap both model calls in `withAITrace` like the existing calls.

Extraction schema (per card): `row`, `col`, `title` (main printed title only, no number or translated subtitle; null if none), `complete` (false if cut off/covered), `box {x0,y0,x1,y1}` as 0..1 fractions.

### Job flow

1. **`detect-sheet` step.** Decisions API predicate (call via `fetch` to `POST /v1/decisions` if the installed `openai@6.16.0` SDK lacks `decisions`). Retry up to 2× on error. Error or `probability < 0.9` → normal path (my call on threshold; spike saw only 0 and 1).
2. **Publish "detected"** on the card channel (new topic, below) so the client toasts and shows the splitting state.
3. **`extract-sheet` step.** Extraction call; drop cards with `complete: false`. Fewer than 2 complete cards, or a parse/model failure → normal path (card continues as a regular single card; client clears the splitting state on the next message/poll).
4. **`split-sheet` step** (one step so Inngest memoizes it as a unit):
   - Compute `slots = min(cardLimit − currentCardCount + 1, generationLimit − imageGenerationsUsed)` (the `+1` is the uploaded card itself, which gets reused). Admin boards: same limit rules as the existing POST route (admins bypass the generation check there; mirror that). If `slots < 1`, treat as normal path.
   - **Skip cards already on the board (owner decision).** Covers the "unlock, then upload the sheet again" flow: drop any sheet card whose title matches the label of a card *already on the board* (excluding the uploaded card itself). Compare normalized: trim, collapse whitespace, case-insensitive, accent-insensitive. Compare only against existing board cards, **not within the sheet** — Claudia's sheet legitimately has "LA EVALUACIÓN" twice (#28 and #33). Untitled sheet cards are never skipped (accepted gap: an untitled sheet re-uploaded after unlock creates duplicates). A card the user renamed won't match either; acceptable.
   - Take the first `slots` remaining cards in reading order. If every card was skipped, delete the uploaded card (it's a duplicate sheet) and publish `split` with `createdCount: 0`; the client toasts "All cards from this set are already on your board" (my call).
   - **Reuse the uploaded card as sheet card #1**: move the full sheet blob to a sibling path (e.g. `…/cards/<id>/sheet.<ext>`, kept for admin debugging), upload crop #1 as its `original`, set its label to title #1 (if any) and `fromSheet = true`.
   - Insert cards 2..k via `insertCardsWithinLimit` (status `processing`, label = title or `''`, `fromSheet = true`). It is all-or-nothing: if it returns fewer rows than requested (concurrent uploads took slots), recount and retry once with the smaller number.
   - Upload each crop as that card's original (`uploadOriginalImage`) and set `originalImageUrl`.
   - Persist `boards.sheetCardsFound = foundCount` (for the banner).
   - Send `cardGenerateRequested` for cards 2..k with `skipLabeling: true` when a title was found (label already set), otherwise label normally.
5. **Publish "split"** on the card channel `{ foundCount, createdCount }`.
6. The current job continues its normal label/illustration path **for card #1**, now pointing at crop #1 (re-read `originalImageUrl`/label from the DB; skip labeling if a title was found).
7. PostHog server event `sheet_detected` `{ board_id, found_count, created_count, board_is_unlocked }`.

The generation counter is still incremented per card on illustration success, unchanged.

### Illustration prompt

When `card.fromSheet`, append the overlay line from the spike via `buildIllustrationPrompt(overlay)`. Do this in both `generate-card-artwork` and `regenerate-illustration` (regenerate reads the card; combine with any admin `promptOverlay`).

### Schema (additive migration — AGENTS.md)

- `cards.from_sheet boolean not null default false`
- `boards.sheet_cards_found integer null`

`insertCardsWithinLimit` (`lib/boards/add-cards.ts`) inserts by **column position** — add an expression for `from_sheet` in schema order and a field on `NewCard`.

### Realtime + client

- `lib/inngest/channels.ts`: add a `sheet` topic to `cardChannel`: `{ phase: 'detected' } | { phase: 'split', foundCount, createdCount }`, and add it to `cardChannelTopics`.
- `hooks/use-card-stream.ts` / `hooks/use-board-cards.tsx`:
  - `detected` → toast + mark the card `isSplitting` (renders the special state in `components/board-card-grid.tsx`).
  - `split` → full `fetchCards()` reload (the 10 s poll in `use-board-cards.tsx` only merges known cards — it never adds or removes cards).
  - Poll safety net: if the server list contains card IDs the client doesn't know, do a full reload. This covers missed realtime messages (live-only, no replay).
- Banner: on the board page when `!board.isUnlocked && board.sheetCardsFound > cards.length`. Reuse the existing unlock CTA (`components/unlock-prompt.tsx`). Hidden once unlocked.
- Unlocked board, sheet bigger than the remaining slots (my call): no banner; the `split` handler shows a toast "Added 35 of 45 cards — board is full" when `createdCount < foundCount − skippedCount`. Add `skippedCount` to the `split` payload so the client can tell "full" apart from "already on board".

## Testing

- Unit tests (`pnpm test`): slot math (locked/unlocked, existing cards, generation cap, admin), title dedupe (accents/case, in-sheet repeats kept, untitled never skipped, all-skipped case), box → pixel region clamping, extraction response parsing/filtering, `insertCardsWithinLimit` with `fromSheet`.
- Eval: a small `sheets` photo folder (gitignored if it includes customer images) with Claudia's sheet, the synthetic tilted sheet, one real angled phone photo, one sheet without titles, one with cut-off edge cards. A script that runs detect + extract and writes box overlays (port of the spike) is enough; no judge needed.
- Validate locally with unit tests + a manual upload on the dev server; let GitHub Actions run e2e after push (memory: no local e2e while iterating).

## Calls made by the designer (not owner decisions — check these)

1. Detection threshold `probability ≥ 0.9`.
2. Extraction model `gpt-6.1-sol` (vs `gpt-5.5`: same accuracy, 2× slower).
3. Reuse the uploaded card as sheet card #1; keep the full sheet blob at a sibling path for admin debugging.
4. Original-photo-mode boards excluded from v1.
5. Unlocked "board full" toast, and the "already on your board" toast when every card is skipped.

## Left to the builder

- Exact UI of the "splitting" card state and banner layout (follow existing card/processing styles and the Loteria palette).
- Exact toast/banner wording beyond the owner's draft, kept minimal.
- Whether to pad crop boxes by a few pixels or inset them; the spike used raw boxes.
- Downscale/encoding of the image sent to extraction (spike: JPEG q90, longest side ≤ 2048, `detail: 'high'`).
- Inngest concurrency/throttle tuning if a 45-card split floods the per-user throttle (`limit: 10 / 1m`) — fan-out events will queue, which is acceptable.

## Estimate

~1.5–2 days: ~0.5 day job + schema, ~0.5 day client (toast, splitting state, reload, banner, i18n), ~0.5 day tests + eval set, buffer for prompt tuning on real phone photos.
