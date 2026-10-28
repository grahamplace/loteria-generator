# Board Photo Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user uploads one image containing a whole sheet of lotería cards, detect it, cut it into individual cards (titles → labels) within the board's limits, and nudge locked boards to unlock.

**Architecture:** Detection (Decisions API) and extraction (Responses API, strict JSON schema) run as new steps at the top of the existing Inngest job `generate-card-artwork`. A server-side split routine reuses the uploaded card as sheet card #1, inserts the rest via `insertCardsWithinLimit`, uploads per-card crops, and fans out normal generation events. The client gets a new `sheet` realtime topic (toast, "splitting" state, full reload) and a locked-board banner driven by `boards.sheet_cards_found`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Inngest (+ realtime), Drizzle/Neon, OpenAI SDK 6.16 (`responses`, raw `fetch` for `/v1/decisions`), sharp, Vercel Blob, next-intl, vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-board-photo-split-design.md` — read it first; it holds the why and the spike results.

**Worktree:** `/Users/grahamplace/Projects/loteria-board-split` on branch `graham/board-photo-split`. All paths below are relative to it. Never commit `.npmrc`.

## Global Constraints

- Models: `SHEET_DETECT_MODEL = 'gpt-6-luna'` (Decisions API), `SHEET_EXTRACT_MODEL = 'gpt-6.1-sol'` (Responses API). Detection threshold `0.9`.
- Illustration overlay for sheet cards, verbatim: `The input is a scanned lotería card. Illustrate only the picture. Do not reproduce the card border, the card number, or any printed title or caption text.`
- Migrations additive only: `cards.from_sheet boolean not null default false`, `boards.sheet_cards_found integer` (nullable). Generate with `pnpm db:generate`; apply to dev with `pnpm db:migrate` only after confirming the `.env.local` host is `ep-purple-pine-ahl2mh42-pooler…` (AGENTS.md).
- Any failure in the sheet path falls back to the normal single-card flow. Normal uploads must not get slower: nothing new in the POST route.
- Never exceed `FREE_CARD_LIMIT`/`TOTAL_CARD_COUNT` or the board's generation limit (`getGenerationLimit`). Admin uploads skip the generation cap (mirrors POST route).
- Skip detection when `skipIllustration` is true or the event has `fromSheet: true`.
- Price only via `useUnlockPriceDisplay()`; colors via Tailwind theme classes; `…` not `...`; minimal copy.
- All copy in both `messages/en.json` and `messages/es-MX.json` under `BoardEditor.SheetSplit`.
- Use `withAITrace` around both model calls, like existing calls.
- Tests: `pnpm test <path>`; lint: `pnpm lint`; types: `pnpm exec tsc --noEmit`. Do not run e2e locally.

## Review Focus

1. Sheet with cut-off edge cards → those cards are excluded, never cropped half-cards (Task 2 test `drops incomplete cards`).
2. Decisions API errors/timeouts → upload behaves exactly like today; no card stuck in "splitting" (Task 3 test `returns false after 3 failed attempts`; Task 5 test `publishes failed when extraction fails`).
3. Model returns boxes outside 0..1 or inverted → clamped or dropped, never a sharp `extract` crash (Task 2 test `clamps and drops degenerate boxes`).
4. Another upload grabs a slot mid-split → insert retries once with fewer cards instead of failing (Task 4 test `retries insert with smaller count`).
5. Realtime `split` message missed → 10 s poll notices unknown/removed card IDs and does a full reload (Task 6 test for `needsFullReload`).

---

### Task 1: Schema + insert support for `fromSheet`

**Files:**
- Modify: `db/schema.ts` (cards table: add `fromSheet` after `cropData`; boards table: add `sheetCardsFound`)
- Create: `db/migrations/0017_*.sql` (via `pnpm db:generate`)
- Modify: `lib/boards/add-cards.ts` (`NewCard.fromSheet?: boolean`; positional SELECT gets `i.from_sheet` in schema order; record type gets `from_sheet boolean`)

**Interfaces:**
- Produces: `cards.fromSheet: boolean`, `boards.sheetCardsFound: number | null`, `NewCard.fromSheet?: boolean`.

- [ ] Step 1: Add columns: `fromSheet: boolean('from_sheet').notNull().default(false)` on cards (placed after `cropData`), `sheetCardsFound: integer('sheet_cards_found')` on boards.
- [ ] Step 2: `pnpm db:generate` → expect one new migration with exactly two `ALTER TABLE … ADD COLUMN` statements. Rename file to `0017_sheet_split.sql` only if the journal is updated consistently (otherwise keep the generated name).
- [ ] Step 3: Update `insertCardsWithinLimit`: the positional SELECT must list one expression per cards column in schema order — insert `i.from_sheet` right after `i.crop_data`; add `from_sheet: card.fromSheet ?? false` to the payload and `from_sheet boolean` to `jsonb_to_record`.
- [ ] Step 4: Check dev host (`grep -o 'ep-[a-z0-9-]*' .env.local` must print `ep-purple-pine-ahl2mh42-pooler`), then `pnpm db:migrate`. Expected: success.
- [ ] Step 5: `pnpm exec tsc --noEmit && pnpm test` → pass.
- [ ] Step 6: Commit `feat: add from_sheet and sheet_cards_found columns`.

### Task 2: Pure sheet-split helpers

**Files:**
- Create: `lib/sheet-split.ts`
- Test: `__tests__/lib/sheet-split.test.ts`

**Interfaces:**
- Produces:
  - constants `SHEET_DETECT_MODEL`, `SHEET_EXTRACT_MODEL`, `SHEET_DETECT_THRESHOLD = 0.9`, `SHEET_CARD_OVERLAY` (verbatim string above), `SHEET_DETECT_INSTRUCTIONS`, `SHEET_EXTRACT_PROMPT`, `SHEET_EXTRACT_SCHEMA` (port from `.scratch/board-spike/detect-extract.ts` in the main checkout `/Users/grahamplace/Projects/loteria-generator-app/.scratch/board-spike/detect-extract.ts`).
  - `type SheetBox = { x0: number; y0: number; x1: number; y1: number }`
  - `type SheetCard = { row: number; col: number; title: string | null; complete: boolean; box: SheetBox }`
  - `type SheetExtraction = { rows: number; cols: number; cards: SheetCard[] }`
  - `parseSheetExtraction(raw: string): SheetExtraction | null` — JSON parse; null on invalid shape; drops `complete: false`; clamps boxes to 0..1; drops boxes with `x1 - x0 < 0.01` or `y1 - y0 < 0.01`; trims titles, empty → null; sorts by `row`, then `col`.
  - `normalizeTitle(s: string): string` — NFD, strip combining marks, lowercase, collapse whitespace, trim.
  - `computeSheetSlots(a: { cardLimit: number; currentCardCount: number; generationLimit: number; imageGenerationsUsed: number; isAdmin: boolean }): number` — `max(0, min(cardLimit - currentCardCount + 1, isAdmin ? Infinity : generationLimit - imageGenerationsUsed))`. `currentCardCount` includes the uploaded sheet card.
  - `selectSheetCards(cards: SheetCard[], existingLabels: string[], slots: number): { selected: SheetCard[]; skippedCount: number }` — skip a card only if its normalized title matches a normalized existing label; untitled never skipped; repeats within the sheet kept; then take the first `slots`.
  - `boxToRegion(box: SheetBox, width: number, height: number): { left: number; top: number; width: number; height: number } | null` — rounds, clamps to image, null if < 4 px either side.
  - `withSheetOverlay(fromSheet: boolean, adminOverlay?: string | null): string | null` — `fromSheet` false → `adminOverlay ?? null`; true → overlay, plus `\n\n` + admin overlay when present.

- [ ] Step 1: Write failing tests:
  - `drops incomplete cards` — 3 cards, one `complete:false` → 2 returned.
  - `sorts reading order` — input order (2,1),(1,2),(1,1) → (1,1),(1,2),(2,1).
  - `clamps and drops degenerate boxes` — box `{x0:-0.1,y0:0.2,x1:0.3,y1:1.4}` → `{0,0.2,0.3,1}`; box with `x1 <= x0` dropped.
  - `returns null on invalid JSON` and on missing `cards`.
  - `normalizeTitle('  La  Evaluación ') === 'la evaluacion'`.
  - `computeSheetSlots` cases: locked empty board (limit 4, count 1, gen 4/0) → 4; locked with 2 others (count 3) → 2; gen used 3 of 4 → 1; unlocked 54 limit, count 21 → 34; admin with gen exhausted → card-limit result; never negative.
  - `selectSheetCards`: existing `['EL APOYO']`, sheet has `El Apoyo`, `LA EVALUACIÓN`, `LA EVALUACIÓN`, untitled → skippedCount 1, selected keeps both evaluaciones and the untitled; slots 2 → first 2 of the remainder.
  - `boxToRegion({0.1,0.1,0.5,0.5}, 1000, 800)` → `{left:100,top:80,width:400,height:320}`; tiny box → null.
  - `withSheetOverlay(true, 'make it blue')` contains both strings; `withSheetOverlay(false, null)` → null.
- [ ] Step 2: `pnpm test __tests__/lib/sheet-split.test.ts` → FAIL (module missing).
- [ ] Step 3: Implement `lib/sheet-split.ts` (no I/O, no sharp, no openai imports).
- [ ] Step 4: Run tests → PASS.
- [ ] Step 5: Commit `feat: add sheet split helpers`.

### Task 3: Sheet AI calls

**Files:**
- Create: `lib/sheet-split-ai.ts`
- Test: `__tests__/lib/sheet-split-ai.test.ts`

**Interfaces:**
- Consumes: Task 2 constants and `parseSheetExtraction`.
- Produces:
  - `toSheetDataUrl(buffer: Buffer): Promise<string>` — sharp `.rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 })` → `data:image/jpeg;base64,…`.
  - `detectSheet(imageDataUrl: string, meta: { userId: string; boardId: string; cardId: string }): Promise<boolean>` — `fetch('https://api.openai.com/v1/decisions', …)` body `{ model: SHEET_DETECT_MODEL, input: [{ role: 'user', content: [{ type: 'input_image', image_url }] }], questions: [{ type: 'predicate', name: 'is_card_sheet', instructions: SHEET_DETECT_INSTRUCTIONS }] }`; returns `answers[0].probability >= SHEET_DETECT_THRESHOLD`. Up to 3 attempts on non-OK / network error / missing answer; then `false`. Never throws.
  - `extractSheet(imageDataUrl: string, meta: same): Promise<SheetExtraction | null>` — `openai.responses.create({ model: SHEET_EXTRACT_MODEL, input: [{ role: 'user', content: [{ type: 'input_image', image_url, detail: 'high' }, { type: 'input_text', text: SHEET_EXTRACT_PROMPT }] }], text: { format: { type: 'json_schema', name: 'sheet_cards', schema: SHEET_EXTRACT_SCHEMA, strict: true } } })` → `parseSheetExtraction(res.output_text)`. Any thrown error → null.

- [ ] Step 1: Failing tests (mock `global.fetch`, `openai`, `@/lib/ai-tracing` like `__tests__/lib/generate-card-artwork.test.ts`):
  - `detects a sheet at probability 1` → true; request body has `model: 'gpt-6-luna'` and one predicate question.
  - `returns false below threshold` (0.5).
  - `retries then succeeds` (500, then 200 p=1) → true, fetch called twice.
  - `returns false after 3 failed attempts` → false, fetch called 3 times, no throw.
  - `extractSheet returns parsed cards` and `returns null when the call throws`.
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS.
- [ ] Step 5: Commit `feat: add sheet detection and extraction calls`.

### Task 4: Split routine (DB + blob work)

**Files:**
- Create: `lib/boards/delete-card.ts` — `deleteCardAndRenumber(boardId: string, cardId: string, userId: string, opts?: { isDefault?: boolean }): Promise<void>` extracted from the DELETE handler in `app/api/boards/[boardId]/cards/route.ts` (blob cleanup unless default, delete, renumber). Update the route to call it.
- Modify: `lib/blob.ts` — add `uploadSheetImage(userId, boardId, cardId, file: Buffer, contentType: string): Promise<string>` at `users/${userId}/boards/${boardId}/cards/${cardId}/sheet.${ext}` (ext from contentType, default `png`).
- Create: `lib/sheet-split-run.ts`
- Test: `__tests__/lib/sheet-split-run.test.ts`

**Interfaces:**
- Consumes: Task 1 `NewCard.fromSheet`, Task 2 `computeSheetSlots`, `selectSheetCards`, `boxToRegion`, `SheetExtraction`.
- Produces:
  ```ts
  type SplitResult =
    | { status: 'split'; foundCount: number; createdCount: number; skippedCount: number;
        first: { originalImageUrl: string; titled: boolean };
        others: { cardId: string; originalImageUrl: string; titled: boolean }[] }
    | { status: 'all-duplicates'; foundCount: number; skippedCount: number }
    | { status: 'no-slots' };
  splitSheetCard(a: { cardId: string; boardId: string; userId: string; isAdmin: boolean;
    originalImageUrl: string; extraction: SheetExtraction }): Promise<SplitResult>
  ```
  `createdCount` counts card #1. `foundCount = extraction.cards.length` (complete cards only).

Behavior, in order: fetch sheet via `fetchBlob`; load board (`getGenerationLimit`, `isUnlocked` → `TOTAL_CARD_COUNT`/`FREE_CARD_LIMIT`) and its cards; `existingLabels` = labels of cards other than `cardId`; `selectSheetCards`; if `selected` empty and `skippedCount > 0` → `deleteCardAndRenumber`, return `all-duplicates`; `slots = computeSheetSlots(...)`, `< 1` → `no-slots`; `uploadSheetImage` (keep full sheet); crop each selected card with sharp (`.rotate()` then `extract(boxToRegion(...))`, PNG); card #1: `uploadOriginalImage` with crop 1, update `label` (title or keep existing), `fromSheet: true`, `originalImageUrl`; others: `insertCardsWithinLimit(boardId, userId, rows)` with `status: 'processing'`, `label: title ?? ''`, `fromSheet: true` — if it returns `[]`, recount, recompute slots, retry once with the smaller list (empty → only card #1); upload each crop and set `originalImageUrl`; set `boards.sheetCardsFound = foundCount`.

- [ ] Step 1: Failing tests (mock `@/db`, `@/lib/blob`, `@/lib/boards/add-cards`, `@/lib/boards/delete-card`; use a real tiny sharp-generated PNG buffer for crops):
  - `locked empty board splits into 4` — 45 found → createdCount 4, insert called with 3 rows all `fromSheet: true`, board updated with `sheetCardsFound: 45`, sheet image uploaded.
  - `titles become labels` — card #1 update includes `label: 'LOS NIÑOS'`; `first.titled` true; untitled card → `label: ''`, `titled: false`.
  - `skips cards already on board` — existing label `'Los Niños'` → skippedCount 1, first selected is sheet card 2.
  - `all duplicates deletes the uploaded card` → `deleteCardAndRenumber` called, status `all-duplicates`.
  - `retries insert with smaller count` — first insert returns `[]`, recount shows one more card → second call has one fewer row.
- [ ] Step 2: Run → FAIL. Step 3: Implement (`delete-card.ts`, `uploadSheetImage`, `sheet-split-run.ts`, route refactor). Step 4: `pnpm test` (whole suite, route refactor must not break existing tests) → PASS.
- [ ] Step 5: Commit `feat: split sheet uploads into cards`.

### Task 5: Wire into the Inngest jobs + realtime topic

**Files:**
- Modify: `lib/inngest/channels.ts` — `cardChannel` topic `sheet` with schema `z.discriminatedUnion('phase', [z.object({ phase: z.literal('detected') }), z.object({ phase: z.literal('split'), foundCount: z.number(), createdCount: z.number(), skippedCount: z.number() }), z.object({ phase: z.literal('failed') })])`; export `type SheetMessage`; add `'sheet'` to `cardChannelTopics`.
- Modify: `lib/inngest/events.ts` — `cardGenerateRequested` schema gets `fromSheet: z.boolean().optional()`.
- Modify: `lib/inngest/functions/generate-card-artwork.ts`
- Modify: `lib/inngest/functions/regenerate-illustration.ts` — load the card's `fromSheet` inside the existing step that builds the prompt; use `buildIllustrationPrompt(withSheetOverlay(fromSheet, promptOverlay))`.
- Test: extend `__tests__/lib/generate-card-artwork.test.ts`; add a case to the regenerate test if one exists (`grep -l regenerate-illustration __tests__ -r`), else create `__tests__/lib/regenerate-illustration.test.ts` with one test.

**Interfaces:**
- Consumes: Task 3 `toSheetDataUrl`, `detectSheet`, `extractSheet`; Task 4 `splitSheetCard`, `SplitResult`; Task 2 `withSheetOverlay`.
- Produces: realtime `sheet` messages; events with `fromSheet: true`; PostHog `sheet_detected`.

Job flow, before the existing label/illustration branches (make `originalImageUrl` and `skipLabeling` `let`):
1. If `!skipIllustration && !event.data.fromSheet`: `step.run('detect-sheet')` → fetch blob, `toSheetDataUrl`, `detectSheet` → boolean.
2. If true: publish `sheet {phase:'detected'}`; `step.run('extract-sheet')` → `extractSheet` (re-fetch blob inside the step; never return image bytes from a step). Null or `< 2` cards → publish `{phase:'failed'}`, continue normal path.
3. `step.run('split-sheet', () => splitSheetCard({... isAdmin: isAdminEmail(<user email>) }))` — resolve admin by loading the user's email inside the step (`db.query.user` by `userId`) and `isAdminEmail`. Result `no-slots` → publish `failed`, normal path. `all-duplicates` → publish `split` with `createdCount: 0`, return early `{ cardId, split: 'all-duplicates' }` (no counter increment). `split` → `step.sendEvent('fan-out-sheet-cards', others.map(o => cardGenerateRequested.create({ cardId: o.cardId, boardId, userId, originalImageUrl: o.originalImageUrl, skipLabeling: o.titled, fromSheet: true })))` (skip when empty); set `originalImageUrl = first.originalImageUrl`, `skipLabeling = first.titled`, local `fromSheet = true`; publish `split` with counts; `step.run('track-sheet')` captures PostHog `sheet_detected` `{ board_id, found_count, created_count, skipped_count, board_is_unlocked }` (follow the `getPostHogClient` + `shutdown` pattern in the POST route).
4. Illustration branch: `buildIllustrationPrompt(withSheetOverlay(fromSheet || Boolean(event.data.fromSheet)))`.

- [ ] Step 1: Failing tests (mock `@/lib/sheet-split-ai` and `@/lib/sheet-split-run`):
  - `skips detection when skipIllustration` — `detect-sheet` not in `runNames`.
  - `skips detection for fromSheet events` and their prompt includes `SHEET_CARD_OVERLAY`.
  - `normal photo path unchanged` — detect false → no `extract-sheet`, no `sheet` publish.
  - `publishes failed when extraction fails` — extract null → publish `sheet {phase:'failed'}`, illustration still generated.
  - `split fans out and continues with card 1 crop` — `step.sendEvent` called with N-1 events all `fromSheet: true`; `fetchBlob` for the illustration called with `first.originalImageUrl`; publish `split` with counts.
  - `all duplicates returns early` — no `images.edit` call.
  - regenerate: `fromSheet card gets overlay` — prompt contains `SHEET_CARD_OVERLAY`.
- [ ] Step 2: Run → FAIL. Step 3: Implement (add `sendEvent` to the test's `makeStep`). Step 4: `pnpm test && pnpm exec tsc --noEmit` → PASS.
- [ ] Step 5: Commit `feat: detect and split sheet uploads in artwork job`.

### Task 6: Client — toast, splitting state, reload, banner, copy

**Files:**
- Modify: `hooks/use-card-stream.ts` — callback `onSheet?: (msg: SheetMessage) => void`; fire once per phase (track seen phases in a `Set`).
- Create: `lib/cards/needs-full-reload.ts` — `needsFullReload(localIds: string[], serverIds: string[]): boolean` (ignores `temp-` ids; true if either side has an id the other lacks).
- Test: `__tests__/lib/needs-full-reload.test.ts`
- Modify: `hooks/use-board-cards.tsx` — local card type gets `isSplitting?: boolean`; 4th param `onSheetSplit?: () => void`; `CardStreamSubscription` forwards `onSheet`; handler: `detected` → `toast(t('detected'))`, set `isSplitting: true`; `split` → toast `allAlreadyOnBoard` when `createdCount === 0`, toast `boardFull` (`{ created, found }`) when `isUnlocked && createdCount < foundCount - skippedCount`; then `fetchCards()` and `onSheetSplit?.()`; `failed` → `isSplitting: false`. Poll: after fetching, if `needsFullReload(local, server)` → `fetchCards()` instead of merging.
- Modify: `components/board-card-grid.tsx` — when `card.isSplitting`, show `t('splitting')` (namespace `BoardEditor.SheetSplit`) in place of `processing` text.
- Create: `components/sheet-unlock-banner.tsx` — `SheetUnlockBanner({ foundCount, onUnlock }: { foundCount: number; onUnlock: () => void })`: one line of text + button reusing the page's unlock button label (`unlockButtonShort` with `useUnlockPriceDisplay()`), `role="status"`, secondary (Marigold) tint, wraps on mobile, 44px button.
- Modify: `app/[locale]/boards/[boardId]/page.tsx` — pass `refreshBoard` as `onSheetSplit`; render banner above `BoardActionBar` when `!board.isUnlocked && (board.sheetCardsFound ?? 0) > cards.length`, `onUnlock={() => openUnlockPrompt('card_limit')}`.
- Modify: `messages/en.json`, `messages/es-MX.json` — `BoardEditor.SheetSplit`:

| key | en | es-MX |
|---|---|---|
| detected | Existing lotería set detected, processing… | Detectamos un juego de lotería completo. Procesando… |
| splitting | Splitting set… | Separando cartas… |
| boardFull | Added {created} of {found} cards — board is full | Se agregaron {created} de {found} cartas: el tablero está lleno |
| allAlreadyOnBoard | All cards from this set are already on your board | Todas las cartas de este juego ya están en tu tablero |
| banner | We found {count} cards in your photo. Unlock this board, then upload it again to import the full set. | Encontramos {count} cartas en tu foto. Desbloquea este tablero y vuelve a subirla para importar el juego completo. |

- [ ] Step 1: Failing test `needsFullReload`: same ids → false; server has extra → true; local has id server lacks → true; `temp-x` local ignored.
- [ ] Step 2: Run → FAIL. Step 3: Implement all files above. Step 4: `pnpm test && pnpm lint && pnpm exec tsc --noEmit` → PASS.
- [ ] Step 5: Visual check: `pnpm dev` (or reuse running server per memory `reference_second_dev_server_and_video.md`), render the banner by setting `sheet_cards_found = 45` on a locked dev board via SQL, screenshot desktop + 390px width.
- [ ] Step 6: Commit `feat: sheet split toast, splitting state, and unlock banner`.

### Task 7: Sheet eval script

**Files:**
- Create: `scripts/sheet-eval/run.ts` — usage `pnpm exec tsx scripts/sheet-eval/run.ts <image...>`; for each image: `detectSheet`, `extractSheet`, write `<out>/<name>-overlay.jpg` (blue box = card) and `<name>.json` to `scripts/sheet-eval/runs/<UTC timestamp>/`; print one JSON line per image `{ file, isSheet, ms, count, titles }`.
- Modify: `.gitignore` — `scripts/sheet-eval/photos/`, `scripts/sheet-eval/runs/`.
- Modify: `.claude/skills/image-model-eval/SKILL.md` — 3-line section "Sheet split eval" with the command.

- [ ] Step 1: Implement (reuse `lib/sheet-split-ai.ts`; overlay drawing as in the spike).
- [ ] Step 2: Run on the spike images (`/private/tmp/claude-501/-Users-grahamplace-Projects-loteria-generator-app/505dc031-1739-4fae-a9aa-83b064d4bdcf/scratchpad/spike/claudia.png`, `…/synthetic.jpg`, `scripts/image-eval/photos/01-portrait.jpg`) → claudia 45 cards, synthetic 12, portrait `isSheet: false`.
- [ ] Step 3: Commit `chore: add sheet split eval script`.
