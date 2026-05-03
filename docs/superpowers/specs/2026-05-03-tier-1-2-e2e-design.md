# Tier 1 + Tier 2 E2E Test Suite Design

**Date:** 2026-05-03
**Status:** Approved
**Builds on:** `2026-05-03-e2e-testing-foundation-design.md`

## Goal

Add 11 Playwright tests covering the core revenue, auth, and board-editor workflows of the Lotería generator. The existing `signout.spec.ts` already covers sign-out; this design adds the rest of Tier 1 (auth + unlock) and all of Tier 2 (card/board editor flows).

## Non-Goals

- Real Stripe checkout UI flow (deferred to a nightly job)
- Real Inngest AI illustration generation — bypassed via `NEXT_PUBLIC_SKIP_AI_PROCESSING=true` so cards complete synchronously with the original image as the illustration
- Google OAuth (needs a test Google account or mock)
- Locale switching tests (Tier 3, separate effort)

## Environment

The e2e test run sets `NEXT_PUBLIC_SKIP_AI_PROCESSING=true` (in `.env.test` and the CI e2e job env). With this flag, the cards POST handler at `app/api/boards/[boardId]/cards/route.ts:178` skips the Inngest job and marks the card `completed` immediately with the original image as the illustration. This removes the need for an Inngest dev server in CI and makes upload tests deterministic.

## Architecture

### Helpers (new files in `e2e/helpers/`)

Shared utilities that test specs import. Keep these tiny and obvious; they exist so test files stay focused on the user behavior, not the plumbing.

**`e2e/helpers/db.ts`** — Drizzle client pointed at the ephemeral branch `databaseUrl`. Reused across helpers; one connection per worker.

```ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@/db/schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required for e2e helpers');
export const db = drizzle(neon(url), { schema });
```

**`e2e/helpers/seed-board.ts`** — Insert a board for the seeded user. Returns `{ id, name }`.

```ts
export async function seedBoard(opts?: { name?: string; isUnlocked?: boolean }): Promise<{ id: string; name: string }>
```

**`e2e/helpers/seed-cards.ts`** — Insert N cards for a board, defaulting to `status='completed'` so they count toward `processedCount`. Each card gets sequential numbers (1..N) and label `Card N`. Includes a placeholder `illustrationUrl` so PDF rendering doesn't fail.

```ts
export async function seedCards(boardId: string, count: number, opts?: { status?: 'processing' | 'completed' }): Promise<void>
```

**`e2e/helpers/seed-user.ts`** — Create a fresh user via `auth.api.signUpEmail` and return `{ email, password }`. Used by tests that need an isolated user (signup, full-quota tests). Generates `e2e-${Date.now()}-${random}@example.com`.

**`e2e/helpers/login-as.ts`** — Helper that logs in as an arbitrary user via `page.request.post('/api/auth/sign-in/email')`. Used when the default seeded user isn't appropriate (signup tests, etc.).

**`e2e/helpers/stripe-webhook.ts`** — Build a signed `checkout.session.completed` event and POST it to `/api/stripe/webhook`. Returns the response. Uses `stripe.webhooks.generateTestHeaderString()` from the official Stripe SDK with `process.env.STRIPE_WEBHOOK_SECRET`.

```ts
export async function unlockBoardViaWebhook(
  request: APIRequestContext,
  opts: { boardId: string; userId: string; sessionId?: string }
): Promise<void>
```

**`e2e/helpers/cleanup.ts`** — Two functions:
- `deleteBoardsForUser(userId)` — delete all boards (and cascading cards) for a user. Used in `test.afterEach` for the shared user.
- `deleteUser(userId)` — delete a user and their boards/cards/profile. Used by signup test's `afterAll`.

### Fixtures

**`e2e/fixtures/test-card.png`** — A small (~5KB) solid-color PNG used by the upload test. Checked into git.

**`e2e/fixtures/stripe-checkout-completed.ts`** — Builds a Stripe `checkout.session.completed` event payload with the metadata shape the webhook handler expects (`boardId`, `userId`). Not a static JSON file because we need to inject IDs at test time.

### User & Board Isolation

- **Shared seeded user** (`e2etest@example.com`) — already created by `e2e-seed-user.ts` script during branch provisioning. Reused by all tests that don't need a unique identity.
- **Per-test boards** — every test that touches boards creates its own board(s) via `seedBoard()` in `test.beforeEach`. No shared board state.
- **Per-test users** for signup tests — `seed-user.ts` generates unique emails. The signup test needs to drive the actual UI signup flow, so it doesn't pre-seed; it generates a fresh email and submits the form.
- **Cleanup** — each spec file has an `afterEach` that calls `cleanup.ts` to remove the shared user's boards. The whole branch is destroyed after the run anyway, but cleanup keeps tests order-independent within a file.

### Stripe Webhook Setup

The webhook handler at `app/api/stripe/webhook/route.ts:23` calls `verifyWebhookSignature(payload, signature)`, which delegates to `stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)` (`lib/stripe.ts:55`). The Stripe SDK exposes `stripe.webhooks.generateTestHeaderString({ payload, secret })` which produces a valid `Stripe-Signature` header for any payload.

CI environment and local `.env.test` must have `STRIPE_WEBHOOK_SECRET` set to the same value used by both the app (when verifying) and the webhook helper (when signing). Any `whsec_...` formatted value works — Stripe's signing functions don't validate the secret against Stripe's records, only that the same secret is used to sign and verify. The user will add `STRIPE_WEBHOOK_SECRET` (and `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` test values) to `.env.test` and to GitHub secrets before merging.

### Test Tooling Additions

- `package.json` adds `@neondatabase/serverless` and `drizzle-orm` are already deps; no new runtime deps needed for helpers.
- Stripe SDK already installed; no new dep.
- New script: `e2e:reset` (delete all boards for the seeded user) — useful when iterating locally.

## Test Specifications

Each test below is one Playwright `.spec.ts` file. All tests assume `auth.setup.ts` has logged in the shared user, EXCEPT signup which uses an unauthenticated context (override `storageState: undefined` on the project, or use a separate test project).

### Tier 1 Tests

**1. `e2e/signup.spec.ts` — new user can sign up**

Setup: Override storage state to unauthenticated (`test.use({ storageState: { cookies: [], origins: [] } })`).

Steps:
1. `page.goto('/sign-up')`
2. Fill `name`, unique `email` (`signup-${Date.now()}@example.com`), `password`
3. Click submit
4. Assert URL becomes `/(en/)?dashboard` (matches both default + en-prefixed routes)
5. Assert dashboard shows an empty state (no boards yet)
6. Cleanup: delete the new user from DB in `afterAll`

**2. `e2e/signin.spec.ts` — existing user can sign in**

Setup: Override storage state to unauthenticated.

Steps:
1. `page.goto('/sign-in')`
2. Fill seeded user email + password
3. Click submit
4. Assert URL becomes `/(en/)?dashboard`
5. Cleanup: none

**3. `e2e/board-create.spec.ts` — user can create their first board**

Pre: Authenticated as seeded user, no existing boards (cleanup in `beforeEach`).

Steps:
1. `page.goto('/dashboard')`
2. Click "Create new board" / Plus button
3. Assert URL changes to `/(en/)?boards/<uuid>`
4. Assert the welcome screen renders (no cards yet, "Start free preview" CTA or 4 empty slots)
5. Cleanup: `afterEach` deletes user's boards

**4. `e2e/free-tier-limit.spec.ts` — adding the 5th card shows unlock prompt**

Pre: Seed a free (locked) board with 4 completed cards via `seedBoard()` + `seedCards(boardId, 4)`.

Steps:
1. `page.goto('/boards/<id>')`
2. Assert 4 cards rendered, board shows "4/4" status
3. Trigger "add card" via UI (file input). Note: actual upload won't matter — server returns 403 before upload completes.
4. Assert the unlock prompt modal is visible (`UnlockPrompt` component, looks for accessible "Unlock" CTA with "$5" text)

Alternative if file-input simulation is fragile: assert that the "add" button shows the disabled-with-prompt state. We'll prefer the actual flow if it's not flaky.

**5. `e2e/board-unlock-paid.spec.ts` — webhook unlocks board**

Pre: Seed a free (locked) board with 4 cards.

Steps:
1. `page.goto('/boards/<id>')`
2. Assert board shows "4/4" / locked state
3. POST signed `checkout.session.completed` fixture to `/api/stripe/webhook` with `metadata.boardId = <id>`, `metadata.userId = <seeded user id>`
4. Assert webhook returns 200
5. Assert DB: `boards.is_unlocked = true` for that board
6. `page.reload()` (the UI doesn't have realtime — reload is the realistic user behavior after Stripe redirect)
7. Assert UI now shows 54 max card slots (e.g., "4/54" status, no unlock prompt)

### Tier 2 Tests

**6. `e2e/card-upload-photo.spec.ts` — uploading an image creates a card**

Pre: Seed an empty unlocked board (so we don't worry about quota limits muddying the assertion).

Steps:
1. `page.goto('/boards/<id>')`
2. Locate the file input (hidden but accessible via `page.setInputFiles()` on the inputRef element)
3. `setInputFiles('e2e/fixtures/test-card.png')`
4. Assert a new card appears in the grid (count goes 0 → 1)
5. Assert the card renders as completed (visible illustration thumbnail, no spinner)
6. Assert DB: 1 row in `cards` for this board with `status='completed'`, non-null `originalImageUrl`, and `illustrationUrl == originalImageUrl` (per skip-AI behavior)
7. Cleanup: `afterEach` deletes user's boards

**7. `e2e/card-edit-label.spec.ts` — editing a card's label persists**

Pre: Seed an unlocked board with 1 completed card (label: "Card 1").

Steps:
1. `page.goto('/boards/<id>')`
2. Click on the seeded card to open the edit modal
3. Find the label input, clear it, type `El Sol`
4. Click Save
5. Assert modal closes
6. Assert the card's visible label is "El Sol"
7. `page.reload()`
8. Assert label is still "El Sol" (persistence check)

**8. `e2e/card-delete.spec.ts` — deleting a card removes it**

Pre: Seed an unlocked board with 2 completed cards.

Steps:
1. `page.goto('/boards/<id>')`
2. Open edit modal for card 1
3. Click delete
4. Confirm in the AlertDialog
5. Assert card count goes 2 → 1
6. Assert DB: 1 row in `cards` for this board

Tooling note: AlertDialog confirmation must NOT use `window.confirm` — verify it's a custom AlertDialog component (per AGENTS.md "Do not trigger JavaScript alerts" rule). Existing code uses `AlertDialog` (per board-card-grid.tsx), so safe.

**9. `e2e/board-rename.spec.ts` — user can rename a board**

Pre: Seed an unlocked board named "Original Name".

Steps:
1. `page.goto('/boards/<id>')`
2. Click the board name (triggers `isEditingName`)
3. Find the rename input, clear, type "Renamed Board"
4. Blur or press Enter to save
5. Assert the displayed name updates
6. `page.reload()`
7. Assert renamed name persists
8. Assert DB: `boards.name = 'Renamed Board'`

**10. `e2e/board-delete.spec.ts` — user can delete a board from the dashboard**

Pre: Seed two boards (so dashboard isn't empty after deletion).

Steps:
1. `page.goto('/dashboard')`
2. Assert 2 boards visible
3. Click MoreVertical menu on board 1
4. Click Delete
5. Confirm in AlertDialog
6. Assert board 1 disappears, 1 board remains
7. Assert DB: 1 board row remains for the user

**11. `e2e/board-export-paid.spec.ts` — unlocked board exports PDF**

Pre: Seed an unlocked board with 16 completed cards (each with placeholder `illustrationUrl`).

Steps:
1. `page.goto('/boards/<id>')`
2. Assert export button is enabled (not "more needed")
3. Set up `page.waitForEvent('download')` listener
4. Click Export
5. Await the download event
6. Assert downloaded file: name matches `*-loteria-set.pdf`, size > 0 (sanity)
7. Assert success toast appears
8. Click Export a second time (verify unlimited for unlocked)
9. Assert second download fires

Note on PDF generation: `generateLoteriaSetPdf()` is client-side. It may take several seconds. Set per-test timeout to 30s.

## CI Changes

Add to `.github/workflows/ci.yml` env block for the e2e job:
- `STRIPE_WEBHOOK_SECRET` — new GitHub secret (any `whsec_...` value matching what's in `.env.test`).
- `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` — Stripe test mode values, needed because the webhook handler initializes a Stripe client at module load.
- `NEXT_PUBLIC_SKIP_AI_PROCESSING=true` — non-secret env. Skips Inngest in card POST flow.

The user adds these to `.env.test` (local) and GitHub secrets (CI) before merging.

## Local Development

`docs/e2e-setup.md` updated with the new env vars and a section on running individual test files (`pnpm test:e2e e2e/card-edit-label.spec.ts`).

## Test Execution Order & Parallelism

Playwright defaults to one worker per file in parallel. With 11 tests + setup project + ~8s avg per test, expect ~30-60s test wall time after auth setup, plus ~30-60s for branch provisioning. Total CI job time target: under 3 minutes.

If parallel execution causes flakes (e.g., two workers concurrently mutating the same shared user), fall back to `workers: 1` in `playwright.config.ts`. Initial implementation will keep parallelism on; we'll only restrict if we observe flakes.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Stripe webhook signing logic differs in app vs helper | Reuse the same SDK call (`stripe.webhooks.generateTestHeaderString` matches `constructEvent`'s validation). Webhook handler must accept the test secret value. |
| Card edit modal's label input doesn't have a stable selector | Add an `aria-label` translation key if needed during implementation, similar to the user-menu fix from the foundation work. |
| `generateLoteriaSetPdf` is slow / flaky | 30s per-test timeout; if still flaky, mock the function in the export test and assert the click triggered it. |
| Direct DB inserts diverge from real schema (e.g., missing required columns) | Use Drizzle's typed `insert()` so schema mismatches fail at type-check time. |
| Parallel workers race on `e2etest@example.com` | Cleanup is per-test, boards are per-test. If a race happens, switch to per-worker users (each worker logs in as a different seeded account). |

## Out of Scope (Tier 3, future)

- Locale switching, marketing CTA, dashboard board list with multiple boards
- AI illustration completion (Inngest E2E)
- Real Stripe Checkout UI walkthrough (nightly)
- Google OAuth signin
