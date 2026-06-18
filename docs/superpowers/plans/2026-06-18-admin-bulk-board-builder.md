# Admin Bulk Board Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only tool on `/admin/boards` to bulk-upload photos into a new Loteria board, with a toggle that uses each file's name (minus extension) as the card label instead of AI labeling (illustration still runs).

**Architecture:** Reuse the consumer API paths (`POST /api/boards`, `POST /api/boards/[boardId]/cards`) with small admin-gated branches (Approach A). A new `skipLabeling` flag flows from the client → card-create route → Inngest event → `generate-card-artwork`, where it skips the AI label step and preserves the filename label. Admin requests bypass card/generation limits and create unlocked boards.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle/Neon, Inngest, Vercel Blob, Vitest, React 19, Tailwind v4.

**Test commands:** Run Vitest on specific files to avoid the stale `.claude/worktrees/` checkout, e.g. `pnpm exec vitest run __tests__/lib/filename-label.test.ts`. Final verification: `pnpm typecheck` and `pnpm exec vitest run __tests__`.

---

## Task 1: `filenameToLabel` helper

**Files:**
- Create: `lib/filename-label.ts`
- Test: `__tests__/lib/filename-label.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/filename-label.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filenameToLabel } from '@/lib/filename-label';

describe('filenameToLabel', () => {
  it('strips a single extension', () => {
    expect(filenameToLabel('el corazon.jpg')).toBe('el corazon');
  });

  it('strips only the last extension on dotted names', () => {
    expect(filenameToLabel('La Dama.v2.PNG')).toBe('La Dama.v2');
  });

  it('returns the name unchanged when there is no extension', () => {
    expect(filenameToLabel('noext')).toBe('noext');
  });

  it('trims surrounding whitespace', () => {
    expect(filenameToLabel('  El Perro .png ')).toBe('El Perro');
  });

  it('returns empty string for empty or whitespace-only input', () => {
    expect(filenameToLabel('')).toBe('');
    expect(filenameToLabel('   ')).toBe('');
    expect(filenameToLabel('.png')).toBe('');
  });

  it('handles uppercase extensions', () => {
    expect(filenameToLabel('GATO.JPEG')).toBe('GATO');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/lib/filename-label.test.ts`
Expected: FAIL — cannot resolve `@/lib/filename-label`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/filename-label.ts`:

```ts
/**
 * Derive a card label from an uploaded file's name by stripping the last
 * extension and trimming whitespace. Used by the admin bulk-upload tool when
 * "use filename as label" is enabled. Returns '' when nothing usable remains.
 */
export function filenameToLabel(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  return base.trim();
}
```

Note: `lastDot > 0` (not `>= 0`) keeps leading-dot names like `.png` collapsing to `''` after trim, and avoids treating a dotfile's only dot as an extension boundary.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run __tests__/lib/filename-label.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/filename-label.ts __tests__/lib/filename-label.test.ts
git commit -m "feat: add filenameToLabel helper for admin bulk upload"
```

---

## Task 2: Add `skipLabeling` to `createCardSchema`

**Files:**
- Modify: `lib/validations.ts:26-29`
- Test: `__tests__/lib/validations.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/validations.test.ts` (inside the file; add an import for `createCardSchema` if not already imported):

```ts
import { createCardSchema } from '@/lib/validations';

describe('createCardSchema skipLabeling', () => {
  it('accepts skipLabeling true', () => {
    const parsed = createCardSchema.safeParse({ label: 'El Sol', skipLabeling: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.skipLabeling).toBe(true);
  });

  it('accepts payloads without skipLabeling (optional)', () => {
    const parsed = createCardSchema.safeParse({ label: 'El Sol' });
    expect(parsed.success).toBe(true);
  });

  it('rejects non-boolean skipLabeling', () => {
    const parsed = createCardSchema.safeParse({ skipLabeling: 'yes' });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/lib/validations.test.ts`
Expected: FAIL — `skipLabeling` is stripped/undefined and the non-boolean case still parses.

- [ ] **Step 3: Write minimal implementation**

In `lib/validations.ts`, change `createCardSchema`:

```ts
// POST /api/boards/[boardId]/cards
export const createCardSchema = z.object({
  originalImageBase64: base64ImageString.optional(),
  label: z.string().max(200).optional(),
  // Admin-only: when true, the supplied label is used verbatim and the AI
  // label step is skipped (illustration still runs). Ignored for non-admins.
  skipLabeling: z.boolean().optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run __tests__/lib/validations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validations.ts __tests__/lib/validations.test.ts
git commit -m "feat: add skipLabeling to createCardSchema"
```

---

## Task 3: Add `skipLabeling` to the Inngest event + skip-label branch in `generate-card-artwork`

**Files:**
- Modify: `lib/inngest/events.ts:4-11`
- Modify: `lib/inngest/functions/generate-card-artwork.ts`
- Test: `__tests__/lib/generate-card-artwork.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/generate-card-artwork.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { captured, updateSetSpy, cardsFindFirst, chatCreate, imagesEdit } = vi.hoisted(() => ({
  captured: {} as { handler?: (arg: unknown) => Promise<unknown> },
  updateSetSpy: vi.fn(),
  cardsFindFirst: vi.fn(),
  chatCreate: vi.fn(),
  imagesEdit: vi.fn(),
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: (_config: unknown, handler: (arg: unknown) => Promise<unknown>) => {
      captured.handler = handler;
      return {};
    },
  },
}));

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: { completions: { create: chatCreate } },
    images: { edit: imagesEdit },
  })),
  toFile: vi.fn(async () => 'file'),
}));

vi.mock('@/db', () => ({
  db: {
    query: { cards: { findFirst: cardsFindFirst } },
    update: () => ({
      set: (v: unknown) => {
        updateSetSpy(v);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  },
  boards: { id: 'boards.id', imageGenerationsUsed: 'boards.imageGenerationsUsed' },
  cards: { id: 'cards.id', label: 'cards.label' },
}));

vi.mock('@/lib/blob', () => ({
  fetchBlob: vi.fn(async () => ({ buffer: Buffer.from('orig'), contentType: 'image/png' })),
  uploadIllustration: vi.fn(async () => 'https://blob/illustration.png'),
}));
vi.mock('@/lib/image-normalize', () => ({
  normalizeImageForOpenAI: vi.fn(async () => Buffer.from('normalized')),
}));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));
vi.mock('@/lib/ai-tracing', () => ({
  withAITrace: (_name: string, _meta: unknown, fn: () => unknown) => fn(),
}));

import '@/lib/inngest/functions/generate-card-artwork';

const CARD = '00000000-0000-0000-0000-000000000001';
const BOARD = '00000000-0000-0000-0000-000000000002';

function makeStep() {
  const runNames: string[] = [];
  return {
    runNames,
    step: {
      run: vi.fn(async (name: string, fn: () => unknown) => {
        runNames.push(name);
        return fn();
      }),
      realtime: { publish: vi.fn(async () => {}) },
    },
  };
}

function persistCall() {
  return updateSetSpy.mock.calls
    .map((c) => c[0] as Record<string, unknown>)
    .find((v) => v.status === 'completed');
}

beforeEach(() => {
  vi.clearAllMocks();
  imagesEdit.mockResolvedValue({ data: [{ b64_json: Buffer.from('img').toString('base64') }] });
});

describe('generate-card-artwork skipLabeling', () => {
  it('skips the AI label step and preserves the existing label when skipLabeling is true', async () => {
    cardsFindFirst.mockResolvedValue({ label: 'El Sol' });
    const { runNames, step } = makeStep();

    await captured.handler!({
      event: {
        data: {
          cardId: CARD,
          boardId: BOARD,
          userId: 'u1',
          originalImageUrl: 'https://blob/o.png',
          skipLabeling: true,
        },
      },
      step,
    });

    expect(runNames).not.toContain('generate-label');
    expect(chatCreate).not.toHaveBeenCalled();
    const persisted = persistCall();
    expect(persisted).toBeDefined();
    expect(persisted).not.toHaveProperty('label');
    expect(persisted!.illustrationUrl).toBe('https://blob/illustration.png');
  });

  it('runs AI labeling and persists the AI label when skipLabeling is falsy', async () => {
    chatCreate.mockResolvedValue({ choices: [{ message: { content: 'La Luna' } }] });
    const { runNames, step } = makeStep();

    await captured.handler!({
      event: {
        data: {
          cardId: CARD,
          boardId: BOARD,
          userId: 'u1',
          originalImageUrl: 'https://blob/o.png',
        },
      },
      step,
    });

    expect(runNames).toContain('generate-label');
    expect(chatCreate).toHaveBeenCalledOnce();
    const persisted = persistCall();
    expect(persisted!.label).toBe('La Luna');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/lib/generate-card-artwork.test.ts`
Expected: FAIL — the first test fails because `generate-label` still runs and `label` is always present in the persist set.

- [ ] **Step 3a: Add `skipLabeling` to the event schema**

In `lib/inngest/events.ts`, update `cardGenerateRequested`:

```ts
export const cardGenerateRequested = eventType('card/generate.requested', {
  schema: z.object({
    cardId: z.string().uuid(),
    boardId: z.string().uuid(),
    userId: z.string(),
    originalImageUrl: z.string().url(),
    skipLabeling: z.boolean().optional(),
  }),
});
```

- [ ] **Step 3b: Add the skip-label branch in `generate-card-artwork.ts`**

In `lib/inngest/functions/generate-card-artwork.ts`, change the handler body. Destructure `skipLabeling`:

```ts
  async ({ event, step }) => {
    const { cardId, boardId, userId, originalImageUrl, skipLabeling } = event.data;
    const ch = cardChannel({ cardId });
```

Replace the `labelPromise` IIFE with a branch that, when `skipLabeling`, loads the existing (filename) label instead of calling the model:

```ts
    const labelPromise = (async () => {
      if (skipLabeling) {
        const label = await step.run('load-existing-label', async () => {
          const card = await db.query.cards.findFirst({
            where: eq(cards.id, cardId),
            columns: { label: true },
          });
          return card?.label ?? '';
        });
        await step.realtime.publish('publish-label', ch.label, { label });
        return label;
      }

      const label = await step.run('generate-label', async () => {
        const { buffer, contentType } = await fetchBlob(originalImageUrl);
        const mime = OPENAI_IMAGE_MIME_TO_EXT[contentType] ? contentType : 'image/png';
        const base64 = buffer.toString('base64');
        const labelModel = 'gpt-5-nano-2025-08-07';
        const result = await withAITrace(
          'generate-label',
          { userId, boardId, cardId, model: labelModel },
          () =>
            openai.chat.completions.create({
              model: labelModel,
              messages: [
                { role: 'system', content: LABEL_SYSTEM_PROMPT },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'image_url',
                      image_url: { url: `data:${mime};base64,${base64}` },
                    },
                    { type: 'text', text: LABEL_USER_PROMPT },
                  ],
                },
              ],
              max_completion_tokens: 500,
              reasoning_effort: 'minimal',
            })
        );
        return result.choices[0].message.content?.trim() || '';
      });
      await step.realtime.publish('publish-label', ch.label, { label });
      return label;
    })();
```

Then update the `persist-card` step so it does **not** overwrite `label` when `skipLabeling` (preserving the filename label saved at card creation):

```ts
    await step.run('persist-card', async () => {
      await db
        .update(cards)
        .set({
          ...(skipLabeling ? {} : { label }),
          illustrationUrl,
          status: 'completed',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, cardId));
    });
```

Leave the illustration step, generation-counter step, realtime `completed` publishes, and `onFailure` unchanged. (`db.query.cards.findFirst` and `eq`/`cards` are already imported in this file.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run __tests__/lib/generate-card-artwork.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/inngest/events.ts lib/inngest/functions/generate-card-artwork.ts __tests__/lib/generate-card-artwork.test.ts
git commit -m "feat: support skipLabeling in card artwork generation"
```

---

## Task 4: Admin bypass in `POST /api/boards`

**Files:**
- Modify: `app/api/boards/route.ts:79-145`
- Test: `__tests__/api/boards-create-admin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/boards-create-admin.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { boardsFindMany, profileFindFirst, insertValuesSpy } = vi.hoisted(() => ({
  boardsFindMany: vi.fn(),
  profileFindFirst: vi.fn(),
  insertValuesSpy: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      boards: { findMany: (...a: unknown[]) => boardsFindMany(...a) },
      userProfiles: { findFirst: (...a: unknown[]) => profileFindFirst(...a) },
    },
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        insertValuesSpy(v);
        return { returning: () => Promise.resolve([{ id: 'new-board', ...v }]) };
      },
    }),
  },
  boards: {},
  userProfiles: {},
}));

import { auth } from '@/lib/auth';
import { POST } from '@/app/api/boards/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const USER = { user: { email: 'user@example.com', id: 'user-1' } };

function makeReq(body: unknown) {
  return new Request('http://localhost/api/boards', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  profileFindFirst.mockResolvedValue({ id: 'x' });
});

describe('POST /api/boards admin behavior', () => {
  it('admin bypasses the board limit and creates an unlocked board', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    // Three existing locked boards would normally exceed the limit of 1.
    boardsFindMany.mockResolvedValue([{ isUnlocked: false }, { isUnlocked: false }, { isUnlocked: false }]);

    const res = await POST(makeReq({ name: 'Admin Board' }));
    expect(res.status).toBe(201);
    expect(insertValuesSpy).toHaveBeenCalledOnce();
    expect(insertValuesSpy.mock.calls[0][0]).toMatchObject({ name: 'Admin Board', isUnlocked: true });
  });

  it('non-admin still hits the board limit', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    boardsFindMany.mockResolvedValue([{ isUnlocked: false }]); // 1 board, max = 1

    const res = await POST(makeReq({ name: 'Mine' }));
    expect(res.status).toBe(403);
    expect(insertValuesSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/api/boards-create-admin.test.ts`
Expected: FAIL — admin currently hits the 403 board limit and the board is not created unlocked.

- [ ] **Step 3: Write minimal implementation**

In `app/api/boards/route.ts`:

Add the import near the top:

```ts
import { isAdminEmail } from '@/lib/admin';
```

After `const { name } = parsed.data;` (line ~97), compute admin status:

```ts
    const isAdmin = isAdminEmail(session.user.email);
```

Change the board-limit guard so admins skip it:

```ts
    if (!isAdmin && existingBoards.length >= maxBoards) {
      return NextResponse.json(
        {
          error: 'Board limit reached',
          message: 'Unlock your current board to create more boards',
          code: 'BOARD_LIMIT_REACHED',
        },
        { status: 403 }
      );
    }
```

Change the insert to mark admin boards unlocked:

```ts
    const [newBoard] = await db
      .insert(boards)
      .values({
        userId: session.user.id,
        name: name || 'My Loteria Board',
        isUnlocked: isAdmin,
      })
      .returning();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run __tests__/api/boards-create-admin.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/boards/route.ts __tests__/api/boards-create-admin.test.ts
git commit -m "feat: admin bypasses board limit and creates unlocked boards"
```

---

## Task 5: Admin bypass + `skipLabeling` propagation in `POST /api/boards/[boardId]/cards`

**Files:**
- Modify: `app/api/boards/[boardId]/cards/route.ts:65-235`
- Test: `__tests__/api/cards-create-admin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/cards-create-admin.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

const { boardsFindFirst, cardsFindMany, insertValuesSpy, sendMock } = vi.hoisted(() => ({
  boardsFindFirst: vi.fn(),
  cardsFindMany: vi.fn(),
  insertValuesSpy: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      boards: { findFirst: (...a: unknown[]) => boardsFindFirst(...a) },
      cards: { findMany: (...a: unknown[]) => cardsFindMany(...a) },
    },
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        insertValuesSpy(v);
        return { returning: () => Promise.resolve([{ id: 'new-card', label: v.label, status: v.status }]) };
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
  },
  boards: {},
  cards: { number: 'cards.number', boardId: 'cards.boardId', id: 'cards.id' },
  IMAGE_GENERATION_LIMIT_FREE: 4,
  IMAGE_GENERATION_LIMIT_PAID: 100,
}));

vi.mock('@/lib/inngest/client', () => ({ inngest: { send: (...a: unknown[]) => sendMock(...a) } }));
vi.mock('@/lib/blob', () => ({
  uploadOriginalImage: vi.fn(async () => 'https://blob/original.png'),
  uploadIllustration: vi.fn(),
  deleteCardImages: vi.fn(),
  base64ToBuffer: vi.fn(() => Buffer.from('x')),
  getContentTypeFromDataUrl: vi.fn(() => 'image/png'),
}));
vi.mock('@/lib/invalidate-board-preview', () => ({ invalidateBoardPreview: vi.fn() }));
vi.mock('@/lib/posthog-server', () => ({ getPostHogClient: () => null }));

import { auth } from '@/lib/auth';
import { POST } from '@/app/api/boards/[boardId]/cards/route';

const ADMIN = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const USER = { user: { email: 'user@example.com', id: 'user-1' } };
const IMG = 'data:image/png;base64,AAAA';
const params = Promise.resolve({ boardId: 'board-1' });

function makeReq(body: unknown) {
  return new Request('http://localhost/api/boards/board-1/cards', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  cardsFindMany.mockResolvedValue([]);
});

describe('POST /api/boards/[boardId]/cards admin skipLabeling', () => {
  it('admin: stores filename label and sends event with skipLabeling true', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    boardsFindFirst.mockResolvedValue({ id: 'board-1', userId: 'admin-1', isUnlocked: true, imageGenerationsUsed: 0 });

    const res = await POST(makeReq({ originalImageBase64: IMG, label: 'El Perro', skipLabeling: true }), { params });
    expect(res.status).toBe(201);
    expect(insertValuesSpy.mock.calls[0][0]).toMatchObject({ label: 'El Perro', status: 'processing' });
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      name: 'card/generate.requested',
      data: { skipLabeling: true, cardId: 'new-card', boardId: 'board-1' },
    });
  });

  it('non-admin: skipLabeling is ignored in the emitted event', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    boardsFindFirst.mockResolvedValue({ id: 'board-1', userId: 'user-1', isUnlocked: false, imageGenerationsUsed: 0 });

    const res = await POST(makeReq({ originalImageBase64: IMG, label: 'El Perro', skipLabeling: true }), { params });
    expect(res.status).toBe(201);
    expect(sendMock.mock.calls[0][0].data.skipLabeling).toBeFalsy();
  });

  it('admin bypasses the card limit', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN as never);
    boardsFindFirst.mockResolvedValue({ id: 'board-1', userId: 'admin-1', isUnlocked: true, imageGenerationsUsed: 0 });
    cardsFindMany.mockResolvedValue(new Array(60).fill({})); // > MAX_CARDS_UNLOCKED (54)

    const res = await POST(makeReq({ originalImageBase64: IMG, label: 'X', skipLabeling: true }), { params });
    expect(res.status).toBe(201);
  });

  it('non-admin still hits the card limit', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(USER as never);
    boardsFindFirst.mockResolvedValue({ id: 'board-1', userId: 'user-1', isUnlocked: false, imageGenerationsUsed: 0 });
    cardsFindMany.mockResolvedValue(new Array(4).fill({})); // == MAX_CARDS_FREE

    const res = await POST(makeReq({ originalImageBase64: IMG, label: 'X' }), { params });
    expect(res.status).toBe(403);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/api/cards-create-admin.test.ts`
Expected: FAIL — event lacks `skipLabeling`, and admin hits the card limit (60 > 54).

- [ ] **Step 3: Write minimal implementation**

In `app/api/boards/[boardId]/cards/route.ts`:

Add the import near the top:

```ts
import { isAdminEmail } from '@/lib/admin';
```

After `const { originalImageBase64, label } = parsed.data;` (line ~87), add:

```ts
    const isAdmin = isAdminEmail(session.user.email);
    const skipLabeling = isAdmin && parsed.data.skipLabeling === true;
```

Change the card-limit guard to skip for admins:

```ts
    if (!isAdmin && existingCards.length >= maxCards) {
```

Change the generation-limit guard to skip for admins — update its condition:

```ts
    if (originalImageBase64 && !skipAIProcessing && !isAdmin) {
```

(The body of that block is unchanged; only the `if` condition gains `&& !isAdmin`.)

Add `skipLabeling` to the Inngest event payload:

```ts
          await inngest.send(
            cardGenerateRequested.create({
              cardId: newCard.id,
              boardId,
              userId: session.user.id,
              originalImageUrl: originalUrl,
              skipLabeling,
            })
          );
```

(The card is already inserted with `label: label || ''`, so the filename label is persisted at creation — no change needed there.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run __tests__/api/cards-create-admin.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/api/boards/[boardId]/cards/route.ts" __tests__/api/cards-create-admin.test.ts
git commit -m "feat: admin card upload bypasses limits and propagates skipLabeling"
```

---

## Task 6: `AdminBulkUpload` component

**Files:**
- Create: `app/(admin)/admin/components/admin-bulk-upload.tsx`
- Test: `__tests__/components/admin-bulk-upload.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/admin-bulk-upload.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminBulkUpload } from '@/app/(admin)/admin/components/admin-bulk-upload';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('AdminBulkUpload', () => {
  it('renders with the filename-label toggle on by default', () => {
    render(<AdminBulkUpload />);
    const toggle = screen.getByRole('checkbox', { name: /use filename as label/i });
    expect(toggle).toBeChecked();
  });

  it('defaults the board name to "Admin Board"', () => {
    render(<AdminBulkUpload />);
    const nameInput = screen.getByLabelText(/board name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Admin Board');
  });

  it('shows a disabled create button until files are selected', () => {
    render(<AdminBulkUpload />);
    const button = screen.getByRole('button', { name: /create board/i });
    expect(button).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run __tests__/components/admin-bulk-upload.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `app/(admin)/admin/components/admin-bulk-upload.tsx`:

```tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { filenameToLabel } from '@/lib/filename-label';

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

interface FileItem {
  file: File;
  label: string;
  status: FileStatus;
  error?: string;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AdminBulkUpload() {
  const router = useRouter();
  const [name, setName] = useState('Admin Board');
  const [useFilenameLabels, setUseFilenameLabels] = useState(true);
  const [items, setItems] = useState<FileItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const next: FileItem[] = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, label: filenameToLabel(file.name), status: 'pending' as const }));
    setItems(next);
    setError(null);
  }

  async function handleCreate() {
    if (items.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);

    let boardId: string;
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Admin Board' }),
      });
      if (!res.ok) throw new Error('Failed to create board');
      boardId = (await res.json()).board.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create board');
      setSubmitting(false);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it)));
      try {
        const base64 = await readAsDataUrl(items[i].file);
        const label = useFilenameLabels ? items[i].label : '';
        // If the toggle is on but the derived label is empty, fall back to AI.
        const skipLabeling = useFilenameLabels && label.length > 0;
        const res = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originalImageBase64: base64, label, skipLabeling }),
        });
        if (!res.ok) throw new Error('Upload failed');
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'done' } : it)));
      } catch (e) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: 'error', error: e instanceof Error ? e.message : 'failed' } : it
          )
        );
      }
    }

    router.push(`/admin/boards/${boardId}`);
  }

  return (
    <section className="mb-8 rounded-lg border border-foreground/10 bg-background p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Bulk create board</h2>

      <div className="mb-3 flex flex-col gap-1">
        <label htmlFor="bulk-board-name" className="text-sm font-medium text-foreground">
          Board name
        </label>
        <input
          id="bulk-board-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-foreground/20 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary"
          style={{ touchAction: 'manipulation' }}
        />
      </div>

      <label className="mb-3 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={useFilenameLabels}
          onChange={(e) => setUseFilenameLabels(e.target.checked)}
        />
        Use filename as label (skip AI labeling)
      </label>

      <div className="mb-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => onFilesSelected(e.target.files)}
          className="block text-sm"
        />
      </div>

      {items.length > 0 && (
        <ul className="mb-3 max-h-64 overflow-auto rounded-md border border-foreground/10 text-sm">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="min-w-0 truncate">{it.file.name}</span>
              <span className="shrink-0 text-foreground/60">
                {useFilenameLabels ? it.label || '(AI label)' : '(AI label)'} · {it.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mb-3 text-sm text-primary" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={items.length === 0 || submitting}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        {submitting ? 'Creating…' : 'Create board'}
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run __tests__/components/admin-bulk-upload.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/components/admin-bulk-upload.tsx" __tests__/components/admin-bulk-upload.test.tsx
git commit -m "feat: add AdminBulkUpload component"
```

---

## Task 7: Wire `AdminBulkUpload` into the admin boards page

**Files:**
- Modify: `app/(admin)/admin/boards/page.tsx`

- [ ] **Step 1: Read the current page**

Run: `cat "app/(admin)/admin/boards/page.tsx"` to see the existing structure (it renders `<BoardList>`).

- [ ] **Step 2: Add the component**

Add the import at the top of `app/(admin)/admin/boards/page.tsx`:

```tsx
import { AdminBulkUpload } from '../components/admin-bulk-upload';
```

Render `<AdminBulkUpload />` near the top of the page's returned JSX, directly above the existing boards list/heading content (keep all existing markup). For example, immediately inside the page's root wrapper element:

```tsx
      <AdminBulkUpload />
```

- [ ] **Step 3: Verify it typechecks and the page test (if any) still passes**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/boards/page.tsx"
git commit -m "feat: surface bulk board builder on admin boards page"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 2: Run the full test suite (scoped to repo, excluding stale worktrees)**

Run: `pnpm exec vitest run __tests__`
Expected: all tests pass, including the new files.

- [ ] **Step 3: Lint the changed files**

Run: `pnpm exec eslint lib/filename-label.ts lib/validations.ts lib/inngest/events.ts lib/inngest/functions/generate-card-artwork.ts app/api/boards/route.ts "app/api/boards/[boardId]/cards/route.ts" "app/(admin)/admin/components/admin-bulk-upload.tsx" "app/(admin)/admin/boards/page.tsx"`
Expected: no errors.

- [ ] **Step 4: Final commit (if lint/format made changes)**

```bash
git add -A
git commit -m "chore: lint/format admin bulk board builder" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** filename helper (T1), schema (T2), event+function skip-label (T3), board admin bypass/unlock (T4), card admin bypass + skipLabeling propagation (T5), UI component (T6), page wiring (T7), verification (T8). All spec sections covered.
- **Type consistency:** `skipLabeling: boolean` consistent across schema, event, route, and function. `filenameToLabel(string): string` consistent across helper, component.
- **Edge cases:** empty derived label → `skipLabeling: false` per file (T6); non-admin flag ignored (T5); admin board unlocked so downstream consumer reads treat it as paid (T4).
