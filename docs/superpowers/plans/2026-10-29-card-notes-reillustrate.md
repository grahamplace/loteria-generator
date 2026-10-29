# Card Notes + Re-illustrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consumers can write Notes on a card and press Re-illustrate; the card shows its processing state and swaps in the new illustration when the job finishes.

**Architecture:** Notes are stored in the existing `cards.promptOverlay` column. A new owner-only route atomically claims the card and sends the existing `card/generate.requested` event (skipLabeling), whose job now reads `promptOverlay` from the card row and counts against the board's generation allowance. The modal calls a new `reillustrateCard` hook method; the existing realtime/polling path swaps in the result.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle + Neon, Inngest, zod, next-intl, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-29-card-notes-reillustrate-design.md`

## Global Constraints

- Notes max length: **500** chars (server zod 400 + textarea `maxLength={500}`); trimmed; empty → stored as `null`.
- No DB migration. Reuse `cards.promptOverlay`.
- Prompt header must read exactly: `## Additional Instructions for this card (follow these even where they conflict with the above)`.
- Limit check: non-admin (`isAdminEmail(session.user.email)` false) and `board.imageGenerationsUsed >= getGenerationLimit(board)` → 403 `{ code: 'GENERATION_LIMIT_REACHED' }`.
- All UI strings via next-intl in `messages/en.json` and `messages/es-MX.json` under `BoardEditor.CardEditModal`. Use `…` not `...`. Textarea font `text-[16px] md:text-sm`. Colors only via Tailwind theme classes.
- Run tests with `pnpm vitest run <path>`; full check `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`. **Do not run e2e locally.**
- Commits: no Claude/AI attribution trailers.

## Review Focus

1. Double-click / two tabs pressing Re-illustrate → only one paid generation (atomic claim; second gets 409). Test in Task 2.
2. Queue (`inngest.send`) failure → card not stuck in `processing`; status, preserveOriginal, errorMessage restored. Test in Task 2.
3. Card showing original photo (`preserveOriginal: true`) → re-illustrate flips it to illustrated. Test in Task 2.
4. Job fails after re-illustrate → modal "Try again" re-runs re-illustrate with notes (not the old silent restore). Test in Task 4.
5. Very long / whitespace-only notes → 400 at >500, whitespace-only stored `null`. Test in Task 2.

---

### Task 1: Prompt header + generation job honors stored notes

**Files:**
- Modify: `lib/illustration-prompt.ts` (header string in `buildIllustrationPrompt`)
- Modify: `lib/inngest/functions/generate-card-artwork.ts` (~line 300–330, the illustration step)
- Test: `__tests__/lib/illustration-prompt.test.ts`, `__tests__/lib/generate-card-artwork.test.ts`

**Interfaces:**
- Produces: `generate-card-artwork` builds its prompt as `buildIllustrationPrompt(withSheetOverlay(fromSheet, card.promptOverlay))`, reading `promptOverlay` from the card row inside the illustration step (same pattern `regenerate-illustration.ts` uses for `fromSheet`).

- [ ] **Step 1: Write failing tests**
  - In `illustration-prompt.test.ts`, update the existing overlay test (line ~155) to assert `toContain('## Additional Instructions for this card (follow these even where they conflict with the above)')` and `not.toContain('admin overrides')`.
  - In `generate-card-artwork.test.ts`, add `it('appends the card row promptOverlay to the illustration prompt')`: make the mocked card row lookup return `promptOverlay: 'Keep the glasses'`, run the job (illustration not skipped), assert `promptSent()` contains `'Keep the glasses'`. Add `it('uses no additional instructions when promptOverlay is null')` asserting `not.toContain('## Additional Instructions')`. Follow the file's existing mocking of `db.query.cards.findFirst`.
- [ ] **Step 2: Run** `pnpm vitest run __tests__/lib/illustration-prompt.test.ts __tests__/lib/generate-card-artwork.test.ts` — expect the new assertions to FAIL.
- [ ] **Step 3: Implement.** Change the header text. In the illustration step, `db.query.cards.findFirst({ where: eq(cards.id, cardId), columns: { promptOverlay: true } })` and pass `card?.promptOverlay` as the second arg of `withSheetOverlay`. Keep the read inside the existing step (no new step boundaries).
- [ ] **Step 4: Run** the same command — PASS. Also `pnpm vitest run __tests__/lib/regenerate-illustration.test.ts` — PASS.
- [ ] **Step 5: Commit** `git commit -m "Honor stored card notes in every illustration generation"`

---

### Task 2: Re-illustrate server logic + route

**Files:**
- Create: `lib/cards/reillustrate.ts`
- Create: `app/api/boards/[boardId]/cards/[cardId]/reillustrate/route.ts`
- Test: `__tests__/api/card-reillustrate.test.ts` (copy the mocking style of `__tests__/api/card-photo-mode.test.ts`; also mock `db.query.boards.findFirst` and `@/lib/admin`'s `isAdminEmail`)

**Interfaces:**
- Produces:
  - `export const REILLUSTRATE_NOTES_MAX = 500` (in `lib/cards/reillustrate.ts`)
  - `export class CardReillustrateError extends Error { constructor(public code: 'NO_PHOTO' | 'BUSY' | 'CONFLICT' | 'QUEUE_FAILED' | 'GENERATION_LIMIT_REACHED') }`
  - `export async function reillustrateCard(card: Card, board: Board, notes: string | null, opts: { isAdmin: boolean }): Promise<Card>`
  - Route: `POST /api/boards/[boardId]/cards/[cardId]/reillustrate`, body `{ notes: string }` → `200 { card }` | `400 { error, code? }` | `401` | `404` | `403 { error, code: 'GENERATION_LIMIT_REACHED' }` | `409 { error, code }` | `503 { error, code: 'QUEUE_FAILED' }`.
- Board lookup: `boards` row where `id = boardId`, `userId = session.user.id`, `deletedAt IS NULL` → else 404. Card lookup: `id = cardId`, `boardId`, `userId = session.user.id` → else 404.

- [ ] **Step 1: Write failing tests** (`describe('POST reillustrate')`):
  - `401 without session`
  - `404 when the card belongs to another user` (find returns undefined)
  - `400 NO_PHOTO for a default card` (`isDefault: true, originalImageUrl: null`)
  - `400 when notes exceed 500 chars` (`'x'.repeat(501)`); `send` not called
  - `409 BUSY when card status is processing`; `send` not called
  - `403 GENERATION_LIMIT_REACHED when imageGenerationsUsed >= limit for non-admin` (board `{ isUnlocked:false, generationLimitOverride:null, imageGenerationsUsed:4 }`)
  - `admin bypasses the generation limit` (isAdminEmail → true) → 200
  - `success stores trimmed notes, flips preserveOriginal false, sets processing`: notes `'  Keep the glasses  '` → `mocks.write` called with `objectContaining({ promptOverlay: 'Keep the glasses', preserveOriginal: false, status: 'processing', errorMessage: null })`
  - `whitespace-only notes are stored as null`
  - `sends card/generate.requested with skipLabeling and skipSheetDetection`: `send` called with `objectContaining({ name: 'card/generate.requested', data: objectContaining({ cardId: id, boardId, userId: 'owner', originalImageUrl: original, skipLabeling: true, skipSheetDetection: true, cropData: crop, fromSheet: false }) })`
  - `409 CONFLICT when the claim is lost` (`mocks.claim = false`); `send` not called
  - `503 QUEUE_FAILED rolls back status, preserveOriginal and errorMessage`: `send` rejects → second `write` call `objectContaining({ status: 'completed', preserveOriginal: true, errorMessage: null })` and does not include a `promptOverlay` key
- [ ] **Step 2: Run** `pnpm vitest run __tests__/api/card-reillustrate.test.ts` — FAIL (module not found).
- [ ] **Step 3: Implement `reillustrateCard`.** Order: NO_PHOTO (`isDefault || !originalImageUrl`) → BUSY (`processing`/`pending`) → limit (skip if `opts.isAdmin`) → atomic claim `update(cards).set({ status:'processing', promptOverlay: notes, preserveOriginal:false, errorMessage:null, updatedAt }).where(and(eq(id), eq(status, card.status))).returning()`; empty → CONFLICT → `inngest.send(cardGenerateRequested.create({...}))` with the data in the test; on throw roll back `{ status, preserveOriginal, errorMessage, updatedAt }` where `status = 'processing'`, log, throw QUEUE_FAILED → `invalidateBoardPreview(boardId, userId)` → return updated row. Mirror `lib/cards/photo-mode.ts` structure.
- [ ] **Step 4: Implement route.** zod `z.object({ notes: z.string().max(REILLUSTRATE_NOTES_MAX) })`; normalize `notes.trim() || null`; map codes: NO_PHOTO→400, GENERATION_LIMIT_REACHED→403, BUSY/CONFLICT→409, QUEUE_FAILED→503; unknown → 500. Pattern: the photo-mode route.
- [ ] **Step 5: Run** the test file — PASS. `pnpm exec tsc --noEmit` — clean.
- [ ] **Step 6: Commit** `git commit -m "Add consumer re-illustrate route"`

---

### Task 3: Client plumbing (hook, page, grid)

**Files:**
- Modify: `hooks/use-board-cards.tsx` (BoardCard type, server→client mappings at ~lines 140, 217, 259; new `reillustrateCard`; return value)
- Modify: `app/[locale]/boards/[boardId]/page.tsx` (~line 169 DisplayCard mapping; wire `onReillustrate`)
- Modify: `components/board-card-grid.tsx` (DisplayCard type, props, modal wiring)

**Interfaces:**
- Consumes: Task 2 route + error codes.
- Produces:
  - `BoardCard.promptOverlay?: string | null` and `DisplayCard.promptOverlay?: string | null`
  - `export class ReillustrateError extends Error { constructor(public code: string) }` exported from `hooks/use-board-cards.tsx`
  - `reillustrateCard(cardId: string, notes: string): Promise<void>` — POSTs `{ notes }`; on OK `mergeServerCard(cardId, card)`; on non-OK throws `ReillustrateError(body.code ?? 'UNKNOWN')`.
  - `BoardCardGridProps.onReillustrate?: (id: string, notes: string) => Promise<void>`
  - Grid passes to `CardEditModal`: `card.promptOverlay`, `onReillustrate` (only when `!isDefault && originalImage && onReillustrate`, like `onChangePhotoMode`), `isLocked`, `onUnlockRequired`.
  - Modal props added in Task 4: `onReillustrate?: (notes: string) => Promise<void>`, `isLocked?: boolean`, `onUnlockRequired?: () => void`, and `card.promptOverlay?: string | null` on `LotteriaCard` usage (extend the inline card object type the modal accepts — add `promptOverlay?: string | null` to the modal's `card` prop type rather than to `LotteriaCard` if `LotteriaCard` is shared with board generation).
- [ ] **Step 1:** Add the types/field mappings and `reillustrateCard`; thread through page and grid. Add the modal props to `CardEditModalProps` as optional (no UI yet) so it type-checks.
- [ ] **Step 2: Verify** `pnpm exec tsc --noEmit` clean and `pnpm vitest run __tests__/components/board-card-grid.test.tsx` PASS.
- [ ] **Step 3: Commit** `git commit -m "Thread card notes and re-illustrate through board UI"`

---

### Task 4: Modal Notes + Re-illustrate UI

**Files:**
- Modify: `components/card-edit-modal.tsx`
- Modify: `messages/en.json`, `messages/es-MX.json` (`BoardEditor.CardEditModal`)
- Test: `__tests__/components/card-edit-modal.test.tsx` (new; follow i18n/render helpers used by other component tests, e.g. `board-card-grid.test.tsx`)

**Interfaces:**
- Consumes: Task 3 modal props.

New en strings (es-MX equivalents written by implementer, reviewed later):
- `notesField`: `"Notes"`
- `notesPlaceholder`: `"Keep the glasses, make the dog brown…"`
- `reillustrateButton`: `"Re-illustrate"`
- `reillustrateLimitLocked`: `"You've used this board's free illustrations."`
- `reillustrateLimit`: `"You've used all the illustrations for this board."`
- `reillustrateUnlock`: `"Unlock board"`
- `reillustrateError`: `"Couldn't start the illustration. Try again."`

- [ ] **Step 1: Write failing tests:**
  - `pre-fills notes from card.promptOverlay` — textarea (by label "Notes") has value `'Keep the glasses'`.
  - `Re-illustrate calls onReillustrate with the notes` — type into textarea, click button → called with typed value.
  - `Cmd+Enter in notes triggers re-illustrate`.
  - `button disabled while isProcessing`.
  - `hides notes section without onReillustrate`.
  - `locked board limit error shows Unlock board, which calls onUnlockRequired` — `onReillustrate` rejects `new ReillustrateError('GENERATION_LIMIT_REACHED')`, `isLocked` → alert text + button; click → `onUnlockRequired` called.
  - `generic failure shows reillustrateError`.
  - `Try again after a failed job re-illustrates with notes instead of switching mode` — `processingError: 'boom'`, both `onReillustrate` and `onChangePhotoMode` provided; click "Try again" (existing `retryIllustration` string) → `onReillustrate` called, `onChangePhotoMode` not called.
- [ ] **Step 2: Run** `pnpm vitest run __tests__/components/card-edit-modal.test.tsx` — FAIL.
- [ ] **Step 3: Implement.** Section placed after the crop button, before Label; rendered only when `originalImage && onReillustrate`. State: `notes` (init `card.promptOverlay ?? ''`), `reillustrating` boolean, `reillustrateError: '' | 'limit' | 'other'`. Button `variant="outline"`, `Sparkles` icon, spinner `Loader2` while `reillustrating` (label kept), disabled when `reillustrating || switching || isProcessing`. On success `posthog.capture('card_reillustrated', { card_number, has_notes, notes_length })`. Errors `role="alert"` `text-sm text-destructive`; limit+`isLocked`+`onUnlockRequired` → also render `Button` "Unlock board" calling `onUnlockRequired` (then `onClose()` so the unlock dialog isn't stacked under the modal). Change the existing non-blocked "Try again" onClick to `onReillustrate ? reillustrate() : changeMode('illustrated')`. Add `htmlFor`/`id="card-notes"` label pairing.
- [ ] **Step 4: Run** the test file — PASS; `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` — clean.
- [ ] **Step 5: Commit** `git commit -m "Add Notes and Re-illustrate to the card editor"`

---

## After all tasks (controller)

- Subagent reviews the es-MX strings (owner doesn't read Spanish).
- Screenshot the modal locally (dev server, unsandboxed) in idle, processing and limit states if feasible.
- Whole-branch review, then PR.
