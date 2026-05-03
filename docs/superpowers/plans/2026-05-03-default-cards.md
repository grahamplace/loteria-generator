# Default Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add traditional ("classic") Lotería cards to a board with no upload and no async wait. Ship with one classic ("La Rosa"), built so adding more is just "drop a webp + add a manifest row."

**Architecture:** Defaults live as static webps in `public/default-cards/` plus a TypeScript manifest in `lib/default-cards.ts`. New columns `is_default` and `default_card_id` on `cards` track type and dedup (via partial unique index). When a classic is added, we write a fully-populated `cards` row with `illustrationUrl` pointing at the public webp — this means the existing grid, PDF export, and preview-generation paths need zero changes. A new `POST /api/boards/[boardId]/cards/defaults` endpoint handles bulk-add with auth/limit/dedup checks. Classics show with a green number badge in the editor; printed boards stay uniform (the badge color toggle is editor-only).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + Neon Postgres, Tailwind CSS v4, shadcn/ui, vitest, next-intl, PostHog, OpenAI gpt-image-1.5 (one-off for the seed asset).

**Spec:** `docs/superpowers/specs/2026-05-03-default-cards-design.md`

---

## File Structure

**Create:**
- `lib/default-cards.ts` — manifest (DEFAULT_CARDS, DEFAULT_CARDS_BY_ID, DefaultCard type)
- `db/migrations/0006_default_cards.sql` — column adds + partial unique index (drizzle-kit generated)
- `app/api/boards/[boardId]/cards/defaults/route.ts` — POST handler
- `components/default-cards-picker.tsx` — modal for browsing + bulk-adding classics
- `public/default-cards/la-rosa.webp` — the seed asset (600×900, generated from user's source photo)
- `__tests__/lib/default-cards.test.ts` — manifest sanity test
- `__tests__/api/default-cards.test.ts` — endpoint test

**Modify:**
- `db/schema.ts` — add `isDefault` and `defaultCardId` columns to `cards`
- `lib/validations.ts` — add `addDefaultCardsSchema`
- `app/api/boards/[boardId]/cards/route.ts` — DELETE handler skips blob cleanup when `isDefault`
- `hooks/use-board-cards.tsx` — add `addDefaultCards(ids: string[])`; thread `isDefault` through `BoardCard` and the optimistic insert
- `app/[locale]/boards/[boardId]/page.tsx` — extend `displayCards` to use the public webp URL directly when the card is a default; pass `isDefault` to the grid
- `components/board-card-grid.tsx` — extend `DisplayCard` with `isDefault`; flip number badge color to `bg-accent` when true; render second card-shaped "Add classic" tile next to "Add more"; mount `DefaultCardsPicker`
- `components/board-action-bar.tsx` — add second "Add classic" button next to "Upload photos"
- `messages/en.json` and `messages/es-MX.json` — new keys under `BoardEditor.ActionBar`, `BoardEditor.CardGrid`, and a new `BoardEditor.DefaultCardsPicker` namespace
- `scripts/example-images/source-photos/la-rosa.jpg` — keep (already added; source for seed asset)

**Out of scope (deferred):**
- Admin UI for the default library
- Bulk seeding the canonical 54-card deck
- A dedicated `pnpm generate:default-cards` script (the existing example-images pipeline + the one-off `generate-la-rosa.ts` cover it)

---

## Task 1: DB schema — add `is_default` and `default_card_id` columns

**Files:**
- Modify: `db/schema.ts`
- Create: `db/migrations/0006_default_cards.sql` (via `pnpm db:generate`)

- [ ] **Step 1: Add the columns to the Drizzle schema**

In `db/schema.ts`, in the `cards` table definition (after `errorMessage`, before `createdAt`):

```ts
isDefault: boolean('is_default').notNull().default(false),
defaultCardId: text('default_card_id'),
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file `db/migrations/0006_<random_name>.sql` containing `ALTER TABLE "cards" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;` and `ADD COLUMN "default_card_id" text`.

- [ ] **Step 3: Append the partial unique index to the generated migration**

Open the new migration file. Append this raw SQL (drizzle-kit doesn't generate partial indexes from the schema, so we hand-write it):

```sql
--> statement-breakpoint
CREATE UNIQUE INDEX "cards_board_default_unique"
  ON "cards" ("board_id", "default_card_id")
  WHERE "default_card_id" IS NOT NULL;
```

- [ ] **Step 4: Apply the migration**

Run: `pnpm db:push`
Expected: drizzle-kit applies the column adds and reports the index creation. No warnings about data loss.

- [ ] **Step 5: Verify in psql / drizzle studio (optional)**

Sanity check: `pnpm db:studio` → cards table has the two new columns and the partial unique index exists.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts db/migrations/
git commit -m "feat(db): add is_default + default_card_id to cards

Plus a partial unique index on (board_id, default_card_id) WHERE NOT NULL
to enforce one-of-each-classic per board."
```

---

## Task 2: Default cards manifest

**Files:**
- Create: `lib/default-cards.ts`
- Create: `__tests__/lib/default-cards.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/default-cards.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CARDS, DEFAULT_CARDS_BY_ID } from '@/lib/default-cards';

describe('DEFAULT_CARDS manifest', () => {
  it('has at least one entry', () => {
    expect(DEFAULT_CARDS.length).toBeGreaterThan(0);
  });

  it('has unique kebab-case ids', () => {
    const ids = DEFAULT_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('every src points to an existing file in public/default-cards/', () => {
    for (const card of DEFAULT_CARDS) {
      expect(card.src).toMatch(/^\/default-cards\/[a-z0-9-]+\.webp$/);
      const filename = card.src.replace(/^\//, '');
      const fsPath = join(process.cwd(), 'public', filename.replace('default-cards/', 'default-cards/'));
      expect(existsSync(fsPath), `missing asset for ${card.id} at ${fsPath}`).toBe(true);
    }
  });

  it('DEFAULT_CARDS_BY_ID resolves every entry', () => {
    for (const card of DEFAULT_CARDS) {
      expect(DEFAULT_CARDS_BY_ID[card.id]).toBe(card);
    }
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test __tests__/lib/default-cards.test.ts`
Expected: FAIL with "Cannot find module '@/lib/default-cards'".

- [ ] **Step 3: Create the manifest**

Create `lib/default-cards.ts`:

```ts
/**
 * Default ("classic") Lotería cards. Static manifest of pre-illustrated cards
 * that users can add to a board without uploading a photo or triggering AI
 * generation.
 *
 * IMMUTABILITY RULE: once an entry is shipped, never delete the webp file or
 * rename its `id` — existing user boards reference these by id and by URL.
 * You may add new entries freely, and you may update `label`/`labelEn`/
 * `traditionalNumber` for an existing entry. Do not change `id` or `src`.
 *
 * Adding a new classic is two steps:
 *   1. Drop the webp at `public/default-cards/<id>.webp` (600×900, q=85)
 *   2. Add a row to DEFAULT_CARDS below
 */
export interface DefaultCard {
  /** Stable kebab-case identifier. Never rename. */
  id: string;
  /** Canonical Spanish name (e.g. "La Rosa"). User-editable after add. */
  label: string;
  /** English helper, shown in the picker tooltip on en locale. */
  labelEn: string;
  /** Position in the canonical 54-card deck, if applicable. */
  traditionalNumber?: number;
  /** Public URL of the webp. Always `/default-cards/${id}.webp`. */
  src: string;
}

export const DEFAULT_CARDS: DefaultCard[] = [
  {
    id: 'la-rosa',
    label: 'La Rosa',
    labelEn: 'The Rose',
    traditionalNumber: 41,
    src: '/default-cards/la-rosa.webp',
  },
];

export const DEFAULT_CARDS_BY_ID: Record<string, DefaultCard> = Object.fromEntries(
  DEFAULT_CARDS.map((card) => [card.id, card])
);
```

- [ ] **Step 4: Place the seed asset**

Confirm `public/default-cards/la-rosa.webp` exists (Task 12 generates it). If not yet, this test will fail until Task 12 lands. Either run Task 12 first, or temporarily skip the file-existence assertion in the test until Task 12.

- [ ] **Step 5: Run the test, confirm it passes**

Run: `pnpm test __tests__/lib/default-cards.test.ts`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/default-cards.ts __tests__/lib/default-cards.test.ts
git commit -m "feat(default-cards): add manifest with La Rosa

Static manifest + lookup map for classic Lotería cards. Documented
immutability rule for shipped entries."
```

---

## Task 3: Validation schema for the new endpoint

**Files:**
- Modify: `lib/validations.ts`

- [ ] **Step 1: Read the current file**

Open `lib/validations.ts` to find where `createCardSchema` and `updateCardSchema` are exported.

- [ ] **Step 2: Add the schema**

After the existing schemas, append:

```ts
export const addDefaultCardsSchema = z.object({
  defaultCardIds: z.array(z.string().min(1)).min(1).max(54),
});
```

(If `z` is imported as `import { z } from 'zod'` already, no extra imports needed.)

- [ ] **Step 3: Commit**

```bash
git add lib/validations.ts
git commit -m "feat(default-cards): add addDefaultCardsSchema validation"
```

---

## Task 4: API endpoint — `POST /api/boards/[boardId]/cards/defaults`

**Files:**
- Create: `app/api/boards/[boardId]/cards/defaults/route.ts`
- Create: `__tests__/api/default-cards.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/default-cards.test.ts`. Mirror the auth/db mocking pattern in `__tests__/api/admin-boards-retry-failed.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const queryFindFirst = vi.fn();
const queryFindMany = vi.fn();
const insertReturning = vi.fn();

vi.mock('@/db', () => ({
  db: {
    query: {
      boards: { findFirst: (...a: unknown[]) => queryFindFirst(...a) },
      cards: { findMany: (...a: unknown[]) => queryFindMany(...a) },
    },
    insert: () => ({
      values: () => ({ returning: () => insertReturning() }),
    }),
  },
  boards: {},
  cards: {},
  IMAGE_GENERATION_LIMIT_FREE: 4,
  IMAGE_GENERATION_LIMIT_PAID: 100,
}));

vi.mock('@/lib/invalidate-board-preview', () => ({
  invalidateBoardPreview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/posthog-server', () => ({
  getPostHogClient: () => ({ capture: vi.fn() }),
}));

import { auth } from '@/lib/auth';
import { POST } from '@/app/api/boards/[boardId]/cards/defaults/route';

const params = Promise.resolve({ boardId: 'board-1' });
const userSession = { user: { id: 'user-1' } };

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/boards/board-1/cards/defaults', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (auth.api.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(userSession);
});

describe('POST /api/boards/[boardId]/cards/defaults', () => {
  it('returns 401 when unauthenticated', async () => {
    (auth.api.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa'] }) as never, { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when board not found / not owned', async () => {
    queryFindFirst.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa'] }) as never, { params });
    expect(res.status).toBe(404);
  });

  it('returns 400 INVALID_DEFAULT_ID when an id is unknown', async () => {
    queryFindFirst.mockResolvedValue({ id: 'board-1', userId: 'user-1', isUnlocked: false, imageGenerationsUsed: 0 });
    queryFindMany.mockResolvedValue([]);
    const res = await POST(makeRequest({ defaultCardIds: ['not-a-real-id'] }) as never, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_DEFAULT_ID');
  });

  it('returns 409 ALREADY_ADDED when classic already on board', async () => {
    queryFindFirst.mockResolvedValue({ id: 'board-1', userId: 'user-1', isUnlocked: false, imageGenerationsUsed: 0 });
    queryFindMany.mockResolvedValue([{ defaultCardId: 'la-rosa', number: 1 }]);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa'] }) as never, { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('ALREADY_ADDED');
  });

  it('returns 403 CARD_LIMIT_REACHED on free tier when over the cap', async () => {
    queryFindFirst.mockResolvedValue({ id: 'board-1', userId: 'user-1', isUnlocked: false, imageGenerationsUsed: 0 });
    queryFindMany.mockResolvedValue([
      { defaultCardId: null, number: 1 },
      { defaultCardId: null, number: 2 },
      { defaultCardId: null, number: 3 },
      { defaultCardId: null, number: 4 },
    ]);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa'] }) as never, { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('CARD_LIMIT_REACHED');
  });

  it('inserts and returns rows on success', async () => {
    queryFindFirst.mockResolvedValue({ id: 'board-1', userId: 'user-1', isUnlocked: false, imageGenerationsUsed: 0 });
    queryFindMany.mockResolvedValue([]);
    insertReturning.mockResolvedValue([
      { id: 'card-1', boardId: 'board-1', userId: 'user-1', number: 1, label: 'La Rosa', illustrationUrl: '/default-cards/la-rosa.webp', isDefault: true, defaultCardId: 'la-rosa', status: 'completed' },
    ]);
    const res = await POST(makeRequest({ defaultCardIds: ['la-rosa'] }) as never, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].defaultCardId).toBe('la-rosa');
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

Run: `pnpm test __tests__/api/default-cards.test.ts`
Expected: FAIL with module-not-found for `@/app/api/boards/[boardId]/cards/defaults/route`.

- [ ] **Step 3: Implement the route**

Create `app/api/boards/[boardId]/cards/defaults/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, boards, cards } from '@/db';
import { addDefaultCardsSchema } from '@/lib/validations';
import { DEFAULT_CARDS_BY_ID } from '@/lib/default-cards';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';
import { getPostHogClient } from '@/lib/posthog-server';

const MAX_CARDS_FREE = 4;
const MAX_CARDS_UNLOCKED = 54;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = await params;
    const body = await request.json();
    const parsed = addDefaultCardsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { defaultCardIds } = parsed.data;

    // Validate every id exists in the manifest.
    const unknown = defaultCardIds.filter((id) => !DEFAULT_CARDS_BY_ID[id]);
    if (unknown.length > 0) {
      return NextResponse.json(
        {
          error: 'Unknown default card id(s)',
          code: 'INVALID_DEFAULT_ID',
          unknownIds: unknown,
        },
        { status: 400 }
      );
    }

    // Verify board ownership.
    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Pull existing cards once for dedup + limit checks.
    const existingCards = await db.query.cards.findMany({
      where: eq(cards.boardId, boardId),
    });

    // Dedup against existing default ids on this board.
    const existingDefaultIds = new Set(
      existingCards.map((c) => c.defaultCardId).filter((id): id is string => !!id)
    );
    const conflicts = defaultCardIds.filter((id) => existingDefaultIds.has(id));
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more classics already on this board',
          code: 'ALREADY_ADDED',
          conflictIds: conflicts,
        },
        { status: 409 }
      );
    }

    // Card-limit check.
    const maxCards = board.isUnlocked ? MAX_CARDS_UNLOCKED : MAX_CARDS_FREE;
    if (existingCards.length + defaultCardIds.length > maxCards) {
      return NextResponse.json(
        {
          error: 'Card limit reached',
          message: board.isUnlocked
            ? `Maximum of ${MAX_CARDS_UNLOCKED} cards allowed`
            : `Unlock this board to add more than ${MAX_CARDS_FREE} cards`,
          code: 'CARD_LIMIT_REACHED',
        },
        { status: 403 }
      );
    }

    // Compute starting number.
    const maxNumber = existingCards.reduce((m, c) => (c.number > m ? c.number : m), 0);

    // Build insert rows.
    const rows = defaultCardIds.map((id, i) => {
      const def = DEFAULT_CARDS_BY_ID[id]!;
      return {
        boardId,
        userId: session.user.id,
        number: maxNumber + i + 1,
        label: def.label,
        originalImageUrl: null,
        illustrationUrl: def.src,
        status: 'completed' as const,
        isDefault: true,
        defaultCardId: id,
      };
    });

    const inserted = await db.insert(cards).values(rows).returning();

    await invalidateBoardPreview(boardId, session.user.id);

    const ph = getPostHogClient();
    if (ph) {
      ph.capture({
        distinctId: session.user.id,
        event: 'default_cards_added',
        properties: {
          count: defaultCardIds.length,
          ids: defaultCardIds,
          board_id: boardId,
        },
      });
    }

    return NextResponse.json({ cards: inserted });
  } catch (error) {
    // Postgres unique_violation in the partial index = concurrent dedup race.
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json(
        { error: 'One or more classics already on this board', code: 'ALREADY_ADDED' },
        { status: 409 }
      );
    }
    console.error('Error adding default cards:', error);
    return NextResponse.json({ error: 'Failed to add default cards' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests, confirm all pass**

Run: `pnpm test __tests__/api/default-cards.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/boards/\[boardId\]/cards/defaults/route.ts __tests__/api/default-cards.test.ts
git commit -m "feat(default-cards): add POST /api/boards/[boardId]/cards/defaults

Bulk-add classics with auth, ownership, manifest validation, dedup,
and card-limit checks. Does not increment image_generations_used."
```

---

## Task 5: Skip blob cleanup on default-card delete

**Files:**
- Modify: `app/api/boards/[boardId]/cards/route.ts`

- [ ] **Step 1: Locate the DELETE handler's blob-cleanup block**

In `app/api/boards/[boardId]/cards/route.ts`, find:

```ts
// Delete images from blob storage
try {
  await deleteCardImages(session.user.id, boardId, cardId);
} catch (blobError) {
  console.error('Error deleting card images:', blobError);
}
```

- [ ] **Step 2: Guard the cleanup**

Replace with:

```ts
// Skip blob cleanup for default cards — the asset is shared/public, not
// a per-user blob upload.
if (!card.isDefault) {
  try {
    await deleteCardImages(session.user.id, boardId, cardId);
  } catch (blobError) {
    console.error('Error deleting card images:', blobError);
  }
}
```

- [ ] **Step 3: Smoke test by hand**

After Tasks 8-10 are implemented you'll verify end-to-end. For now, just confirm the file still type-checks: `pnpm exec tsc --noEmit | head` — no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/boards/\[boardId\]/cards/route.ts
git commit -m "fix(default-cards): skip blob cleanup when deleting a classic

The asset lives in public/default-cards/ and is shared across users."
```

---

## Task 6: Display URL routing in editor page

**Files:**
- Modify: `app/[locale]/boards/[boardId]/page.tsx`
- Modify: `hooks/use-board-cards.tsx`

- [ ] **Step 1: Thread `isDefault` and `defaultCardId` through `BoardCard`**

In `hooks/use-board-cards.tsx`, extend the `BoardCard` interface (after `errorMessage`):

```ts
isDefault: boolean;
defaultCardId: string | null;
```

- [ ] **Step 2: Update the fetchCards mapper**

In `fetchCards`, the `(data.cards || []).map(...)` call already spreads `...card`, which now includes the new columns. Just confirm the spread covers them — no code change needed. Same for `mergeServerCard` (it spreads via `...c`).

- [ ] **Step 3: Update the page mapping**

In `app/[locale]/boards/[boardId]/page.tsx`, find the `displayCards = cards.map(...)` block. Update the `illustration` resolution so default cards use the public URL directly (not the auth-protected `/api/images/...` proxy):

Replace:

```ts
illustration:
  card.localIllustration ||
  card.localOriginalImage ||
  (card.illustrationUrl
    ? `/api/images/${boardId}/${card.id}/illustration`
    : card.originalImageUrl
      ? `/api/images/${boardId}/${card.id}/original`
      : ''),
```

With:

```ts
illustration:
  card.localIllustration ||
  card.localOriginalImage ||
  (card.isDefault && card.illustrationUrl
    ? card.illustrationUrl
    : card.illustrationUrl
      ? `/api/images/${boardId}/${card.id}/illustration`
      : card.originalImageUrl
        ? `/api/images/${boardId}/${card.id}/original`
        : ''),
```

And add `isDefault` to the returned object:

```ts
isDefault: card.isDefault,
```

- [ ] **Step 4: Commit**

```bash
git add app/\[locale\]/boards/\[boardId\]/page.tsx hooks/use-board-cards.tsx
git commit -m "feat(default-cards): route default-card illustration URLs to public path

Defaults render via /default-cards/<id>.webp (public CDN), not the
per-board auth-protected image proxy. Threads isDefault through to
the grid so it can apply the editor-only badge color."
```

---

## Task 7: useBoardCards — `addDefaultCards`

**Files:**
- Modify: `hooks/use-board-cards.tsx`

- [ ] **Step 1: Extend the return type**

In `UseBoardCardsReturn`, after `addCards`, add:

```ts
addDefaultCards: (defaultCardIds: string[]) => Promise<void>;
```

- [ ] **Step 2: Implement the function**

Inside `useBoardCards`, after the existing `addCards` implementation, add:

```ts
const addDefaultCards = useCallback(
  async (defaultCardIds: string[]) => {
    // Resolve label + URL up-front so the optimistic cards render correctly.
    const { DEFAULT_CARDS_BY_ID } = await import('@/lib/default-cards');
    const tempEntries = defaultCardIds.map((id) => {
      const def = DEFAULT_CARDS_BY_ID[id];
      if (!def) throw new Error(`Unknown default card id: ${id}`);
      return { id, def, tempId: createTempId() };
    });

    setCards((prev) => {
      const maxNumber = prev.reduce((max, c) => (c.number > max ? c.number : max), 0);
      const newCards: BoardCard[] = tempEntries.map((entry, i) => ({
        id: entry.tempId,
        clientKey: entry.tempId,
        boardId,
        number: maxNumber + i + 1,
        label: entry.def.label,
        originalImageUrl: null,
        illustrationUrl: entry.def.src,
        status: 'completed' as CardStatus,
        errorMessage: null,
        isDefault: true,
        defaultCardId: entry.id,
      }));
      return [...prev, ...newCards];
    });

    try {
      const res = await fetch(`/api/boards/${boardId}/cards/defaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultCardIds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Roll back all temps for this batch.
        setCards((prev) => prev.filter((c) => !tempEntries.some((e) => e.tempId === c.id)));
        if (data.code === 'CARD_LIMIT_REACHED') {
          toast.error('Card limit reached', { description: data.message });
          return;
        }
        if (data.code === 'ALREADY_ADDED') {
          toast.error('Already added', {
            description: 'One of those classics is already on this board.',
          });
          return;
        }
        if (data.code === 'INVALID_DEFAULT_ID') {
          toast.error('Could not add classic', { description: 'Unknown card id.' });
          return;
        }
        throw new Error('Failed to add classics');
      }

      const { cards: serverCards } = (await res.json()) as { cards: Card[] };
      // Match each temp to its server row by defaultCardId.
      setCards((prev) =>
        prev.map((c) => {
          const matching = serverCards.find((s) => s.defaultCardId === c.defaultCardId);
          if (matching && tempEntries.some((e) => e.tempId === c.id)) {
            return {
              ...c,
              id: matching.id,
              clientKey: matching.id,
              number: matching.number,
              status: matching.status as CardStatus,
              isDefault: matching.isDefault,
              defaultCardId: matching.defaultCardId,
            };
          }
          return c;
        })
      );
    } catch (err) {
      console.error('Error adding default cards:', err);
      setCards((prev) => prev.filter((c) => !tempEntries.some((e) => e.tempId === c.id)));
      toast.error('Failed to add classics');
    }
  },
  [boardId]
);
```

- [ ] **Step 3: Wire it into the return**

In the final `return { ... }` block, add `addDefaultCards` alongside `addCards`.

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-board-cards.tsx
git commit -m "feat(default-cards): add addDefaultCards to useBoardCards hook

Optimistically inserts fully-populated card rows (status=completed,
illustration URL known up-front), reconciles by defaultCardId on
server response, rolls back the batch on error."
```

---

## Task 8: i18n keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es-MX.json`

- [ ] **Step 1: Add keys to en.json**

Find `BoardEditor.ActionBar`. Add keys:

```json
"addClassic": "Add classic",
"addClassicAriaLabel": "Add a classic Lotería card to this board",
"addClassicDisabledTitle": "Card limit reached"
```

Find `BoardEditor.CardGrid`. Add:

```json
"addClassicTile": "ADD CLASSIC"
```

Add a new top-level namespace under `BoardEditor`:

```json
"DefaultCardsPicker": {
  "title": "Classic Lotería cards",
  "subtitle": "Add traditional images to your board — no upload needed.",
  "addButton": "Add {count, plural, one {# classic} other {# classics}} to board",
  "alreadyAdded": "Already added",
  "cardLimitNote": "You've hit the {limit}-card limit for this board.",
  "empty": "All classics are on this board. Remove one to add another.",
  "cancel": "Cancel"
}
```

- [ ] **Step 2: Add the same shape to es-MX.json with placeholder Spanish**

Use these as starter values (a subagent will review them before merge — see Task 13):

```json
"addClassic": "Agregar clásica",
"addClassicAriaLabel": "Agregar una carta clásica de Lotería a este tablero",
"addClassicDisabledTitle": "Límite de cartas alcanzado",
"addClassicTile": "AGREGAR CLÁSICA",
"DefaultCardsPicker": {
  "title": "Cartas clásicas de Lotería",
  "subtitle": "Agrega imágenes tradicionales a tu tablero — sin subir fotos.",
  "addButton": "Agregar {count, plural, one {# clásica} other {# clásicas}} al tablero",
  "alreadyAdded": "Ya agregada",
  "cardLimitNote": "Has alcanzado el límite de {limit} cartas para este tablero.",
  "empty": "Todas las clásicas están en este tablero. Quita una para agregar otra.",
  "cancel": "Cancelar"
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "i18n(default-cards): add en + es-MX strings for the picker and add-classic actions"
```

---

## Task 9: DefaultCardsPicker component

**Files:**
- Create: `components/default-cards-picker.tsx`

- [ ] **Step 1: Confirm shadcn Dialog is available**

Run: `ls components/ui/dialog.tsx`
If absent: `pnpm dlx shadcn@latest add dialog`

- [ ] **Step 2: Create the component**

Create `components/default-cards-picker.tsx`:

```tsx
'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Check, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DEFAULT_CARDS, type DefaultCard } from '@/lib/default-cards';

interface DefaultCardsPickerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
  alreadyAddedIds: Set<string>;
  remainingSlots: number;
}

export function DefaultCardsPicker({
  open,
  onClose,
  onAdd,
  alreadyAddedIds,
  remainingSlots,
}: DefaultCardsPickerProps) {
  const t = useTranslations('BoardEditor.DefaultCardsPicker');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allAdded = useMemo(
    () => DEFAULT_CARDS.every((c) => alreadyAddedIds.has(c.id)),
    [alreadyAddedIds]
  );

  function toggle(id: string) {
    if (alreadyAddedIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= remainingSlots) return prev;
        next.add(id);
      }
      return next;
    });
  }

  function handleAdd() {
    if (selected.size === 0) return;
    onAdd(Array.from(selected));
    setSelected(new Set());
    onClose();
  }

  function handleClose() {
    setSelected(new Set());
    onClose();
  }

  const overLimit = selected.size === remainingSlots && remainingSlots < DEFAULT_CARDS.length;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleClose())}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-caveat text-2xl">{t('title')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        {allAdded ? (
          <div className="py-12 text-center text-muted-foreground">{t('empty')}</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {DEFAULT_CARDS.map((card) => (
              <PickerCell
                key={card.id}
                card={card}
                added={alreadyAddedIds.has(card.id)}
                selected={selected.has(card.id)}
                disabledByLimit={
                  !selected.has(card.id) && !alreadyAddedIds.has(card.id) && selected.size >= remainingSlots
                }
                onToggle={() => toggle(card.id)}
              />
            ))}
          </div>
        )}

        {overLimit ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {t('cardLimitNote', { limit: remainingSlots + alreadyAddedIds.size })}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleAdd} disabled={selected.size === 0}>
            {t('addButton', { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickerCell({
  card,
  added,
  selected,
  disabledByLimit,
  onToggle,
}: {
  card: DefaultCard;
  added: boolean;
  selected: boolean;
  disabledByLimit: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('BoardEditor.DefaultCardsPicker');
  const interactive = !added && !disabledByLimit;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!interactive}
      aria-pressed={selected}
      title={added ? t('alreadyAdded') : `${card.label} — ${card.labelEn}`}
      className={`group relative bg-[#f5f0e1] overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        added
          ? 'border-black/20 opacity-50 cursor-not-allowed'
          : selected
            ? 'border-primary ring-2 ring-primary'
            : 'border-black/80 hover:border-primary cursor-pointer'
      } ${disabledByLimit && !selected ? 'opacity-40 cursor-not-allowed' : ''}`}
      style={{ borderRadius: '2px' }}
    >
      <div className="relative w-full aspect-[2/3] bg-muted overflow-hidden">
        <Image
          src={card.src}
          alt={card.label}
          fill
          sizes="(max-width: 640px) 30vw, 180px"
          className="object-cover pointer-events-none"
          draggable={false}
        />
        {added ? (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="bg-white rounded-full p-1.5 shadow">
              <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            </div>
          </div>
        ) : selected ? (
          <div className="absolute top-2 right-2 bg-primary text-white rounded-full w-7 h-7 flex items-center justify-center shadow">
            <Check className="w-4 h-4" aria-hidden="true" />
          </div>
        ) : (
          <div className="absolute top-2 right-2 bg-white/80 text-foreground rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus className="w-4 h-4" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="p-2 bg-[#f5f0e1]">
        <p className="text-xs font-semibold text-center text-foreground line-clamp-1 uppercase tracking-wide">
          {card.label}
        </p>
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit 2>&1 | head`
Expected: no errors related to this file.

- [ ] **Step 4: Commit**

```bash
git add components/default-cards-picker.tsx
git commit -m "feat(default-cards): add DefaultCardsPicker modal

Browse classics, multi-select with limit awareness, dedup against
already-added ids, and an empty state when all classics are on board."
```

---

## Task 10: Action bar — "Add classic" button

**Files:**
- Modify: `components/board-action-bar.tsx`

- [ ] **Step 1: Add a prop for opening the picker**

Extend `BoardActionBarProps`:

```ts
onOpenDefaults: () => void;
```

- [ ] **Step 2: Render a second button next to "Upload photos"**

Find the upload button JSX. Beside it, add:

```tsx
<button
  type="button"
  onClick={onOpenDefaults}
  disabled={isMaxReached}
  aria-label={t('addClassicAriaLabel')}
  title={isMaxReached ? t('addClassicDisabledTitle') : undefined}
  className="inline-flex items-center gap-2 rounded-md border border-secondary/40 bg-secondary/10 px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary/20 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
>
  <Sparkles className="w-4 h-4 text-secondary-foreground" aria-hidden="true" />
  {t('addClassic')}
</button>
```

(Match the existing upload button's exact size/spacing — copy its className shape, replacing the upload-specific styles with the secondary-tinted treatment above.)

- [ ] **Step 3: Confirm `Sparkles` is in the existing import from lucide-react**

Existing imports already include `Sparkles` per the read of this file earlier. If not, add it.

- [ ] **Step 4: Commit**

```bash
git add components/board-action-bar.tsx
git commit -m "feat(default-cards): action-bar 'Add classic' button"
```

---

## Task 11: Grid — inline tile + green badge for classics + picker mount

**Files:**
- Modify: `components/board-card-grid.tsx`
- Modify: `app/[locale]/boards/[boardId]/page.tsx`

- [ ] **Step 1: Extend `DisplayCard`**

In `board-card-grid.tsx`, add to the interface:

```ts
isDefault?: boolean;
```

- [ ] **Step 2: Flip the badge color in `CardContent`**

Find:

```tsx
<div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full ...">
  {card.number}
</div>
```

Change `bg-primary` to a conditional:

```tsx
<div
  className={`absolute top-2 left-2 ${card.isDefault ? 'bg-accent' : 'bg-primary'} text-primary-foreground rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg z-[1] shadow-md font-caveat`}
>
  {card.number}
</div>
```

(`text-primary-foreground` works for both; verify visually in Task 14. If contrast on accent green is poor, add a per-branch text color: `${card.isDefault ? 'bg-accent text-white' : 'bg-primary text-primary-foreground'}`.)

- [ ] **Step 3: Add the inline "Add classic" tile**

Extend `BoardCardGridProps`:

```ts
onAddClassic?: () => void;
```

In the JSX where the existing "Add more" tile is rendered, render the new tile next to it (only when `cards.length < maxCards` and the unlock CTA is not active):

```tsx
{onAddClassic ? (
  <button
    onClick={onAddClassic}
    className="rounded-sm flex flex-col text-secondary-foreground hover:text-primary hover:bg-secondary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    style={{ border: '1.5px dashed var(--secondary)' }}
    aria-label={t('addClassicTile')}
  >
    <div className="aspect-[2/3] flex flex-col items-center justify-center gap-1.5">
      <div className="w-8 h-8 rounded-full bg-secondary/15 border border-secondary/40 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-secondary-foreground" aria-hidden="true" />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider">
        {t('addClassicTile')}
      </span>
    </div>
    <div className="p-3">
      <p className="text-sm font-semibold text-center uppercase tracking-wide opacity-0 select-none">
        &nbsp;
      </p>
    </div>
  </button>
) : null}
```

Add `import { Sparkles } from 'lucide-react'` to the top (alongside the existing icons).

- [ ] **Step 4: Wire the picker into the editor page**

In `app/[locale]/boards/[boardId]/page.tsx`:

1. Import:

```tsx
import { DefaultCardsPicker } from '@/components/default-cards-picker';
```

2. Add a state hook near the existing modal state:

```tsx
const [defaultsPickerOpen, setDefaultsPickerOpen] = useState(false);
```

3. Pass `onOpenDefaults={() => setDefaultsPickerOpen(true)}` to `<BoardActionBar ...>` and `onAddClassic={() => setDefaultsPickerOpen(true)}` to `<BoardCardGrid ...>`.

4. Compute current classic ids and remaining slots:

```tsx
const alreadyAddedDefaultIds = new Set(
  cards.map((c) => c.defaultCardId).filter((id): id is string => !!id)
);
const remainingSlots = Math.max(0, cardLimit - cards.length);
```

5. At the bottom of the return tree (alongside other modals like UnlockPrompt), render:

```tsx
<DefaultCardsPicker
  open={defaultsPickerOpen}
  onClose={() => setDefaultsPickerOpen(false)}
  onAdd={(ids) => addDefaultCards(ids)}
  alreadyAddedIds={alreadyAddedDefaultIds}
  remainingSlots={remainingSlots}
/>
```

6. Pull `addDefaultCards` from the hook destructure:

```tsx
const { ..., addDefaultCards } = useBoardCards(boardId, board?.isUnlocked);
```

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/board-card-grid.tsx app/\[locale\]/boards/\[boardId\]/page.tsx
git commit -m "feat(default-cards): grid badge color + inline tile + picker wiring

Classics get bg-accent for the number badge in the editor (printed
boards stay uniform). Adds a card-shaped 'ADD CLASSIC' tile next to
the existing 'ADD MORE' tile and mounts DefaultCardsPicker."
```

---

## Task 12: La Rosa asset — convert + place

**Files:**
- Create: `public/default-cards/la-rosa.webp`
- Keep: `scripts/example-images/source-photos/la-rosa.jpg` (already in tree)
- Keep: `scripts/example-images/illustrations/la-rosa.png` (output of one-off script)

- [ ] **Step 1: Verify the PNG was generated**

The one-off `scripts/example-images/generate-la-rosa.ts` should have produced `scripts/example-images/illustrations/la-rosa.png`. Run:

```bash
ls -la scripts/example-images/illustrations/la-rosa.png
```

Expected: file exists, ~1-2 MB. If not, regenerate with `pnpm tsx --env-file=.env.local scripts/example-images/generate-la-rosa.ts`.

- [ ] **Step 2: Inspect the PNG**

Open it visually. Reject and regenerate if:
- Has visible text/numbers/borders
- Doesn't match Lotería style (too photographic, modern vector, etc.)
- Off-center or cropped poorly

To regenerate: `rm scripts/example-images/illustrations/la-rosa.png && pnpm tsx --env-file=.env.local scripts/example-images/generate-la-rosa.ts`

- [ ] **Step 3: Convert to webp at 600×900**

```bash
mkdir -p public/default-cards
cwebp -q 85 -resize 600 900 \
  scripts/example-images/illustrations/la-rosa.png \
  -o public/default-cards/la-rosa.webp
```

- [ ] **Step 4: Verify size + dimensions**

```bash
file public/default-cards/la-rosa.webp
ls -lh public/default-cards/la-rosa.webp
```

Expected: webp, 600×900, ~30-80 KB.

- [ ] **Step 5: Commit**

```bash
git add public/default-cards/la-rosa.webp scripts/example-images/source-photos/la-rosa.jpg
# Optional: -f the PNG too if you want it in tree, but it's gitignored.
git commit -m "feat(default-cards): seed La Rosa illustration

Generated from a copyright-cleared rose photo via the production
gpt-image-1.5 pipeline (ILLUSTRATION_PROMPT). Output sized to 600x900
webp at q=85 to match the marketing-illustration size."
```

---

## Task 13: Spanish translation review (delegate to subagent)

**Files:**
- Possibly modify: `messages/es-MX.json`

Per project memory, the user does not speak Spanish — translation review must be delegated. Dispatch a fresh agent:

- [ ] **Step 1: Dispatch the review**

```text
Agent({
  description: "Spanish translation review for default cards",
  subagent_type: "general-purpose",
  prompt: "Review the new keys in messages/es-MX.json under BoardEditor.ActionBar (addClassic, addClassicAriaLabel, addClassicDisabledTitle), BoardEditor.CardGrid.addClassicTile, and BoardEditor.DefaultCardsPicker (title, subtitle, addButton, alreadyAdded, cardLimitNote, empty, cancel). Compare against the matching keys in messages/en.json. Confirm that: (1) Spanish phrasing reads naturally to a native Mexican Spanish speaker, (2) plural forms in addButton are correct, (3) tone matches the rest of the file (warm, casual product copy, not formal). If any phrasing is off, propose a corrected JSON snippet I can apply. Report findings under 200 words."
})
```

- [ ] **Step 2: Apply the agent's recommended changes**

If the agent flagged corrections, edit `messages/es-MX.json` accordingly.

- [ ] **Step 3: Commit (if changes were made)**

```bash
git add messages/es-MX.json
git commit -m "i18n(default-cards): apply Spanish review feedback"
```

---

## Task 14: Manual verification + dev-server walkthrough

**Files:** none (verification-only)

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Walk the golden path on a free board**

1. Sign in, create a new board.
2. Click **Add classic** in the action bar — modal opens, La Rosa visible, hover shows + affordance.
3. Click La Rosa — selected state (primary outline + check badge).
4. Click "Add 1 classic to board" — modal closes; La Rosa appears in the grid as card #1, with a **green** number badge.
5. Confirm the inline **ADD CLASSIC** tile is present next to **ADD MORE** in the empty slots.
6. Re-open the picker. La Rosa now shows the **✓ Already added** state and is not clickable.
7. Edit La Rosa's label inline → save → label persists.
8. Delete La Rosa → it disappears from the grid; re-open picker → La Rosa is available again.
9. Add La Rosa, then upload 3 custom photos. Confirm: 4 cards total, La Rosa badge is green, the others are red.
10. Try clicking either add tile → unlock prompt opens at the 4-card cap.

- [ ] **Step 3: Walk the export path**

1. Unlock a board ($5) or use a previously unlocked board.
2. Add a mix of classics (when more exist) and customs.
3. Export the board PDF. Open the PDF — confirm **no visual difference** between classic and custom cards. Number badge is the per-board styleOptions color, not green.

- [ ] **Step 4: Check the dev console**

Look for: hydration warnings, image-loading errors, missing translation keys.

- [ ] **Step 5: Verify PostHog event fires**

Open a posthog session recording or live events; add a classic → confirm `default_cards_added` shows up with `{ count: 1, ids: ['la-rosa'], board_id }`.

- [ ] **Step 6: Final commit (if any small fixes were needed)**

```bash
git add <files>
git commit -m "fix(default-cards): manual-verification fixes"
```

---

## Self-review

After implementation, scan the spec checklist:

- [x] DB schema with partial unique index — Task 1
- [x] Manifest + immutability rule documented — Task 2
- [x] Validation schema — Task 3
- [x] POST /defaults endpoint w/ all error codes — Task 4
- [x] DELETE handler skips blob cleanup for defaults — Task 5
- [x] Public URL routing for default illustrations — Task 6
- [x] Hook addDefaultCards with optimistic insert — Task 7
- [x] i18n keys EN + ES — Task 8 + Task 13
- [x] DefaultCardsPicker component — Task 9
- [x] Action bar button — Task 10
- [x] Inline tile + green badge — Task 11
- [x] La Rosa seed asset — Task 12
- [x] Manual verification — Task 14

PostHog event `default_cards_added` is emitted from the API endpoint (Task 4 implementation). No separate task needed.

The export path is verified as untouched in Task 14 step 3 (printed boards stay uniform — that's enforced by NOT passing `isDefault` into `lib/generate-boards.ts`).
