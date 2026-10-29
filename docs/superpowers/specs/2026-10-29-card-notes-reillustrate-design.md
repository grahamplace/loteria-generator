# Card Notes + Re-illustrate (consumer) — Design

**Date:** 2026-10-29
**Branch:** `graham/card-notes-reillustrate`

## Intent

Admins can already attach free-text instructions to a card (`cards.promptOverlay`) and
regenerate its illustration with them (see `2026-06-22-admin-prompt-overlay-design.md`).
Consumers have no way to fix an illustration they don't like ("keep my glasses", "make
the dog brown", "no hat") short of deleting the card and re-uploading. This gives
consumers the same lever: write **Notes** on a card, press **Re-illustrate**, watch the
card go into its processing state, and see the new drawing appear when it's done.

The request came from the owner directly; all decisions below not attributed to the
owner are the designer's calls (marked *[call]*).

## Goals

- In the consumer card edit modal, a **Notes** textarea and a **Re-illustrate** button.
- Notes are saved on the card and pre-filled next time the modal opens.
- Pressing Re-illustrate puts the card into the existing processing state (modal preview
  + grid tile) and swaps in the new illustration when the job finishes — no reload.
- Notes flow into the illustration prompt exactly as admin overlays do.

## Allowance *[call]*

Re-illustrating costs one image generation from the board's existing allowance, the same
counter uploads use (free board: 4, paid: 100, admin override wins). On a free board with
4 illustrated cards this means re-illustrate is effectively a paid feature — the limit
message routes to the existing unlock prompt. Admins bypass the limit.

## Non-goals

- No notes on first upload. Notes apply only to re-illustration (and to later
  regenerations of that card, since they're stored).
- No per-board notes, no prompt preview, no history of past illustrations / undo to the
  previous drawing. *[call]*
- No changes to labels/riddles (re-illustrate keeps the current label).
- No new pricing. Re-illustrating uses the board's existing image-generation allowance.

## Anti-goals

- Must not let a consumer generate images without limit (each call is a paid OpenAI image).
- Must not start two paid generations for one click / double-click / two tabs.
- Must not leave a card stuck in `processing` if queueing fails.

## Decisions

### Storage — reuse `cards.promptOverlay` *[call]*

No migration. Consumer notes and admin overlays are the same field: one set of
per-card instructions. The admin card detail page will therefore show (and can edit) what
the customer wrote, which is useful for support. Admin regenerate and retry-failed keep
working unchanged.

The section header in `buildIllustrationPrompt` changes from
`## Additional Instructions (admin overrides — …)` to a neutral
`## Additional Instructions for this card (follow these even where they conflict with the above)`,
since the text may now come from the card owner. The change only drops the word
"admin overrides"; the instruction's force is identical, so no image eval is run for it
(owner can request one). *[call]* Max length 500 chars (same as riddle),
enforced on server (400) and via `maxLength` on the textarea.

### Generation path — reuse `card/generate.requested` *[call]*

Re-illustrate sends `cardGenerateRequested` (the `generate-card-artwork` job), not the
admin `card/illustration.regenerate` job, because the generate job already:

- increments `boards.imageGenerationsUsed` on success (regenerate does not),
- publishes the `completed` card-channel event the consumer client listens for
  (`useCardStream` → `applyStreamCompletion`), with the polling safety net in
  `use-board-cards` as backup,
- honors `cropData`, `fromSheet`, `skipLabeling`, `skipSheetDetection`,
- runs with per-user concurrency 3 + throttle 10/min.

Event data: `{ cardId, boardId, userId, originalImageUrl, skipLabeling: true,
skipSheetDetection: true, cropData, fromSheet }` — the same shape
`lib/cards/photo-mode.ts` sends.

**Prompt:** `generate-card-artwork` reads `promptOverlay` from the card row (inside the
illustration step, like regenerate reads `fromSheet`) and builds
`buildIllustrationPrompt(withSheetOverlay(fromSheet, promptOverlay))`. Reading from the
row rather than the event means every path that illustrates an existing card (photo-mode
toggle back to illustrated, re-illustrate) honors saved notes. New uploads have a null
overlay, so first-generation behavior is unchanged.

### Server — new route + lib function

`POST /api/boards/[boardId]/cards/[cardId]/reillustrate`, body `{ notes: string }`
(zod: string, max 500; trimmed; empty string → store `null` and re-illustrate with no
notes, i.e. a plain re-roll).

Logic lives in `lib/cards/reillustrate.ts` (mirrors `lib/cards/photo-mode.ts`, throws a
typed `CardReillustrateError` with codes), route maps codes to statuses:

| Check | Code | Status |
|---|---|---|
| no session | — | 401 |
| card not found for (cardId, boardId, session user), or board deleted | — | 404 |
| `isDefault` or no `originalImageUrl` | `NO_PHOTO` | 400 |
| status `processing`/`pending` | `BUSY` | 409 |
| non-admin and `imageGenerationsUsed >= getGenerationLimit(board)` | `GENERATION_LIMIT_REACHED` | 403 |
| atomic claim lost (row changed under us) | `CONFLICT` | 409 |
| `inngest.send` throws | `QUEUE_FAILED` | 503 |

Admin bypass on the limit uses `isAdminEmail(session.user.email)`, matching card upload.
The limit pre-check mirrors upload (counter increments on success, so a few concurrent
in-flight jobs can overshoot by up to the concurrency; accepted, same as upload).

**Atomic claim** (single `UPDATE … WHERE id = ? AND status = <observed status> RETURNING`):
set `status: 'processing'`, `promptOverlay: notes`, `preserveOriginal: false`,
`errorMessage: null`, `updatedAt`. Setting `preserveOriginal: false` means a card that
was showing the original photo switches to illustrated — the user asked for an
illustration. *[call]* Then `inngest.send`; on failure, restore the previous
`status`, `preserveOriginal`, `errorMessage` (keep the new notes) where status is still
`processing`, and throw `QUEUE_FAILED`. Then `invalidateBoardPreview`. Return the updated
card row as `{ card }`.

`errorDismissedAt` is not touched (admin-only concern).

### Client hook

`use-board-cards` gains `reillustrateCard(cardId, notes): Promise<void>`:

- POST to the route. On OK, `mergeServerCard(cardId, card)` → card becomes
  `isProcessing`, `CardStreamSubscription` mounts, completion swaps the image.
- On non-OK, throw an `Error` whose message is the response `code` (or a generic code),
  so the modal can show the right inline message.
- `BoardCard` gains `promptOverlay?: string | null`, populated in the same places that
  map server cards (initial load, `mergeServerCard`, polling merge).
- It must also be threaded through the board page mapping
  (`app/[locale]/boards/[boardId]/page.tsx`, ~line 169, which builds the grid's
  `DisplayCard`) and `BoardCardGrid`'s `DisplayCard` type, then passed to the modal as
  `card.promptOverlay`. The grid gains `onReillustrate?: (id, notes) => Promise<void>`,
  wired by the page to `reillustrateCard`, and passes `onUnlockRequired` and `isLocked`
  into the modal for the limit case.

### Modal UX (`components/card-edit-modal.tsx`)

Shown only when the card has an original photo, isn't a default card, and the grid
passes `onReillustrate` (wired like `onChangePhotoMode`).

Placement: directly under the image previews / crop button, above Label. *[call]*

- Label: **Notes** (`<label htmlFor>`), `<textarea id="card-notes" rows={2}
  maxLength={500}>`, `text-[16px] md:text-sm`, same styling as riddle textarea,
  placeholder e.g. `Keep the glasses, make the dog brown…`. Pre-filled from
  `card.promptOverlay`.
- Button: **Re-illustrate** (`Sparkles` icon, `variant="outline"`), full width on mobile.
  ⌘/Ctrl+Enter in the notes textarea triggers it.
- Disabled while `isProcessing`, `switching`, or the request is in flight; shows a
  spinner (keeps label) while the request is in flight.
- On success: modal stays open. The existing preview overlay ("Creating illustration…")
  shows because `isProcessing` is now true; when the job completes the preview
  re-renders with the new image (preview is keyed by src; `card.illustration` includes
  `imageVersion`, which `applyStreamCompletion` bumps). The grid tile shows its usual
  processing state too. The user can close the modal at any time.
- Errors inline under the button, `role="alert"`:
  - `GENERATION_LIMIT_REACHED` on a **locked** board → "You've used this board's free
    illustrations." plus an **Unlock board** button that calls the grid's existing
    `onUnlockRequired` (the page opens `UnlockPrompt` with trigger `'card_limit'`, which
    already reads "free limit reached"). No dead end. *[call]*
  - `GENERATION_LIMIT_REACHED` on an **unlocked** board → "You've used all the
    illustrations for this board." (paid limit is 100; rare, no further action).
  - anything else → "Couldn't start the illustration. Try again."
- **Failed job retry (fixes current behavior for this flow):** today the modal's
  "Try again" button calls `changeMode('illustrated')`, which for a previously-illustrated
  card silently restores the old drawing without generating. When `onReillustrate` is
  provided, the non-blocked "Try again" button instead calls re-illustrate with the
  current notes textarea value. The blocked case keeps "Use original photo". When
  `onReillustrate` is not provided, behavior is unchanged. *[call]*
- Re-illustrate does **not** save label/riddle edits; Save still does. Notes are saved by
  Re-illustrate only (no separate save of notes via the Save button). *[call]* — notes only
  matter when illustrating, and silently saving them without illustrating would make the
  pre-fill misleading.
- Minimal copy per AGENTS.md: no helper text under Notes beyond the placeholder.

All new strings in `messages/en.json` and `messages/es-MX.json` under
`BoardEditor.CardEditModal`. The owner doesn't read Spanish: have a subagent review the
Spanish strings.

### Analytics

`posthog.capture('card_reillustrated', { card_number, has_notes, notes_length })` on the
client when the request succeeds.

## Testing

- Unit: `buildIllustrationPrompt` header text; `withSheetOverlay` unchanged.
- API route tests (pattern: `__tests__/api/card-photo-mode.test.ts`): 401, 404 (other
  user's card), 400 NO_PHOTO (default card), 400 notes > 500, 409 BUSY, 403 limit for
  non-admin, admin bypasses limit, success persists trimmed notes / `null` for empty,
  flips `preserveOriginal` false, sends `card/generate.requested` with `skipLabeling`,
  `skipSheetDetection`, `cropData`, `fromSheet`; queue failure rolls back and 503.
- `generate-card-artwork`: if there is an existing test harness for it, assert the prompt
  includes the row's `promptOverlay`; otherwise unit-test via the builder only.
- Component test for the modal: notes pre-fill, button calls `onReillustrate(notes)`,
  disabled while processing, limit error renders inline.
- No local e2e (owner's preference: let CI run e2e).

## Left to the builder

- Exact Tailwind layout within the modal, icon choice details.
- Whether the hook's error carries the code via a small custom error class or message.
- Exact wording of Spanish strings (reviewed by subagent).
