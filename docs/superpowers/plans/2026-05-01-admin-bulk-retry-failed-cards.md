# Admin Bulk Retry Failed Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click "Retry failed (N)" flow to the admin board detail page (and a callable `POST /api/admin/boards/[id]/retry-failed` endpoint) that re-queues every `error`-status card on a board, with the cards grid updating live as Inngest workers complete each retry.

**Architecture:** New board-level Inngest realtime channel (`board:{boardId}`) is published to from both card-generation Inngest functions; admin board page becomes a thin server wrapper around a client cards grid that subscribes to the channel via `useRealtime` and patches local state on `cardUpdated` events. New admin-only API endpoint optimistically flips errored cards to `processing` then fans out the existing `card/illustration.regenerate` event in a single `inngest.send([…])` batch, with rollback on send failure.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM (Neon Postgres), Inngest 4.2 (`inngest`, `inngest/react` — `useRealtime`, `getClientSubscriptionToken`), better-auth (admin gate via `requireAdmin` from `lib/admin.ts`), shadcn/ui (`AlertDialog`, `Button`), `sonner` for toasts, vitest for tests.

**Spec:** `docs/superpowers/specs/2026-05-01-admin-bulk-retry-failed-cards-design.md`

---

## File Structure

**New:**
- `app/api/admin/boards/[id]/retry-failed/route.ts` — admin-gated POST endpoint, optimistic update + Inngest fan-out, rollback on send failure.
- `app/actions/admin-board-realtime.ts` — admin-gated server action returning a board-level subscription token.
- `app/(admin)/admin/components/retry-failed-button.tsx` — client; confirmation dialog + POST + toast + `router.refresh()`.
- `app/(admin)/admin/components/admin-board-cards-grid.tsx` — client; renders the cards grid, subscribes to the board channel, patches local card state on `cardUpdated`.
- `__tests__/api/admin-boards-retry-failed.test.ts` — vitest unit tests for the API route.

**Modified:**
- `lib/inngest/channels.ts` — add `boardChannel` + `boardChannelTopics`.
- `lib/inngest/functions/regenerate-illustration.ts` — publish to `boardChannel.cardUpdated` on processing, completed, and onFailure.
- `lib/inngest/functions/generate-card-artwork.ts` — publish to `boardChannel.cardUpdated` at the same lifecycle points.
- `app/(admin)/admin/boards/[id]/page.tsx` — compute `errorCount`, render `<RetryFailedButton>` in the Board Info card, replace inlined cards grid with `<AdminBoardCardsGrid>`.

---

## Task 1: Add board-level Inngest realtime channel

**Files:**
- Modify: `lib/inngest/channels.ts`

- [ ] **Step 1: Add boardChannel definition**

Replace the file at `lib/inngest/channels.ts` with:

```ts
import { realtime } from 'inngest';
import { z } from 'zod';

export const cardChannel = realtime.channel({
  name: ({ cardId }: { cardId: string }) => `card:${cardId}`,
  topics: {
    label: {
      schema: z.object({ label: z.string() }),
    },
    illustration: {
      schema: z.object({ illustrationUrl: z.string() }),
    },
    completed: {
      schema: z.object({
        label: z.string(),
        illustrationUrl: z.string(),
      }),
    },
    error: {
      schema: z.object({ message: z.string() }),
    },
  },
});

export const cardChannelTopics = ['label', 'illustration', 'completed', 'error'] as const;

export const boardChannel = realtime.channel({
  name: ({ boardId }: { boardId: string }) => `board:${boardId}`,
  topics: {
    cardUpdated: {
      schema: z.object({
        cardId: z.string().uuid(),
        status: z.enum(['pending', 'processing', 'completed', 'error']),
        illustrationUrl: z.string().url().optional(),
        errorMessage: z.string().nullable().optional(),
      }),
    },
  },
});

export const boardChannelTopics = ['cardUpdated'] as const;
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no new errors)

- [ ] **Step 3: Commit**

```bash
git add lib/inngest/channels.ts
git commit -m "feat(inngest): add board-level realtime channel for cardUpdated events"
```

---

## Task 2: Publish to boardChannel from regenerateIllustration

**Files:**
- Modify: `lib/inngest/functions/regenerate-illustration.ts`

- [ ] **Step 1: Add boardChannel publishes at three lifecycle points**

In `lib/inngest/functions/regenerate-illustration.ts`:

Update the import line for channels:
```ts
import { cardChannel, boardChannel } from '../channels';
```

Inside the `onFailure` handler, after the existing `step.realtime.publish('error', ch.error, { message })` call, add:
```ts
await step.realtime.publish('publish-board-error', boardChannel({ boardId: event.data.event.data.boardId as string }).cardUpdated, {
  cardId,
  status: 'error',
  errorMessage: message,
});
```

In the main function body, after the `set-processing` step but before the long generation step, add:
```ts
await step.realtime.publish('publish-board-processing', boardChannel({ boardId }).cardUpdated, {
  cardId,
  status: 'processing',
});
```

After the existing `await step.realtime.publish('publish-illustration', ch.illustration, { illustrationUrl });` line, add:
```ts
await step.realtime.publish('publish-board-completed', boardChannel({ boardId }).cardUpdated, {
  cardId,
  status: 'completed',
  illustrationUrl,
});
```

The full updated file should look like:

```ts
import OpenAI, { toFile } from 'openai';
import { eq } from 'drizzle-orm';
import { db, cards } from '@/db';
import { uploadIllustration, fetchBlob } from '@/lib/blob';
import { normalizeImageForOpenAI } from '@/lib/image-normalize';
import { inngest } from '../client';
import { illustrationRegenerateRequested } from '../events';
import { cardChannel, boardChannel } from '../channels';
import { OPENAI_IMAGE_MIME_TO_EXT } from './generate-card-artwork';
import { ILLUSTRATION_PROMPT } from '@/lib/illustration-prompt';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';
import { withAITrace } from '@/lib/ai-tracing';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const regenerateIllustration = inngest.createFunction(
  {
    id: 'regenerate-illustration',
    triggers: [illustrationRegenerateRequested],
    concurrency: { key: 'event.data.userId', limit: 1 },
    retries: 2,
    onFailure: async ({ event, error, step }) => {
      const { cardId, boardId } = event.data.event.data as { cardId: string; boardId: string };
      const message = error.message || 'Failed to regenerate illustration';

      await step.run('persist-error', async () => {
        await db
          .update(cards)
          .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
          .where(eq(cards.id, cardId));
      });

      const ch = cardChannel({ cardId });
      await step.realtime.publish('error', ch.error, { message });
      await step.realtime.publish(
        'publish-board-error',
        boardChannel({ boardId }).cardUpdated,
        { cardId, status: 'error', errorMessage: message }
      );
    },
  },
  async ({ event, step }) => {
    const { cardId, boardId, userId, originalImageUrl } = event.data;
    const ch = cardChannel({ cardId });

    await step.run('set-processing', async () => {
      await db
        .update(cards)
        .set({ status: 'processing', errorMessage: null, updatedAt: new Date() })
        .where(eq(cards.id, cardId));
    });

    await step.realtime.publish(
      'publish-board-processing',
      boardChannel({ boardId }).cardUpdated,
      { cardId, status: 'processing' }
    );

    const illustrationUrl = await step.run('generate-and-upload-illustration', async () => {
      const { buffer, contentType } = await fetchBlob(originalImageUrl);
      if (!OPENAI_IMAGE_MIME_TO_EXT[contentType]) {
        throw new Error(
          `Unsupported image format "${contentType}". Please upload PNG, JPEG, WebP, or GIF.`
        );
      }
      const normalized = await normalizeImageForOpenAI(buffer);
      const imageFile = await toFile(normalized, 'image.png', { type: 'image/png' });
      const illustrationModel =
        process.env.NODE_ENV === 'production' ? 'gpt-image-1.5' : 'gpt-image-1-mini';
      const result = await withAITrace(
        'regenerate-illustration',
        { userId, boardId, cardId, model: illustrationModel },
        () =>
          openai.images.edit({
            model: illustrationModel,
            image: imageFile,
            prompt: ILLUSTRATION_PROMPT,
            size: '1024x1536',
          })
      );
      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error('Failed to generate illustration');
      const illustrationBuffer = Buffer.from(b64, 'base64');
      return uploadIllustration(userId, boardId, cardId, illustrationBuffer);
    });

    await step.run('persist-illustration', async () => {
      await db
        .update(cards)
        .set({
          illustrationUrl,
          status: 'completed',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, cardId));
    });

    await step.run('invalidate-preview', async () => {
      await invalidateBoardPreview(boardId, userId);
    });

    await step.realtime.publish('publish-illustration', ch.illustration, { illustrationUrl });
    await step.realtime.publish(
      'publish-board-completed',
      boardChannel({ boardId }).cardUpdated,
      { cardId, status: 'completed', illustrationUrl }
    );

    return { cardId, illustrationUrl };
  }
);
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/inngest/functions/regenerate-illustration.ts
git commit -m "feat(inngest): publish boardChannel cardUpdated events from regenerate-illustration"
```

---

## Task 3: Publish to boardChannel from generateCardArtwork

**Files:**
- Modify: `lib/inngest/functions/generate-card-artwork.ts`

- [ ] **Step 1: Add boardChannel publishes**

In `lib/inngest/functions/generate-card-artwork.ts`:

Update the channels import:
```ts
import { cardChannel, boardChannel } from '../channels';
```

In the `onFailure` handler, the existing block reads only `cardId` from event data. Update it to also pull `boardId`, and add a `boardChannel` publish after the existing per-card error publish:

```ts
onFailure: async ({ event, error, step }) => {
  const { cardId, boardId } = event.data.event.data as { cardId: string; boardId: string };
  const message = error.message || 'Failed to generate card artwork';

  await step.run('persist-error', async () => {
    await db
      .update(cards)
      .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
      .where(eq(cards.id, cardId));
  });

  const ch = cardChannel({ cardId });
  await step.realtime.publish('error', ch.error, { message });
  await step.realtime.publish(
    'publish-board-error',
    boardChannel({ boardId }).cardUpdated,
    { cardId, status: 'error', errorMessage: message }
  );
},
```

In the main function body, after the existing `await step.realtime.publish('publish-illustration', ch.illustration, { illustrationUrl });` line inside `illustrationPromise`, add a board-level publish (still inside `illustrationPromise`):

```ts
await step.realtime.publish(
  'publish-board-illustration',
  boardChannel({ boardId }).cardUpdated,
  { cardId, status: 'processing', illustrationUrl }
);
```

(Status stays `processing` here because the DB row isn't `completed` until `persist-card` runs.)

After the final `await step.realtime.publish('completed', ch.completed, { label, illustrationUrl });` call (near the end of the function body), add:

```ts
await step.realtime.publish(
  'publish-board-completed',
  boardChannel({ boardId }).cardUpdated,
  { cardId, status: 'completed', illustrationUrl }
);
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/inngest/functions/generate-card-artwork.ts
git commit -m "feat(inngest): publish boardChannel cardUpdated events from generate-card-artwork"
```

---

## Task 4: Add admin board realtime token server action

**Files:**
- Create: `app/actions/admin-board-realtime.ts`

- [ ] **Step 1: Create the server action**

Create `app/actions/admin-board-realtime.ts`:

```ts
'use server';

import { requireAdmin } from '@/lib/admin';
import { getClientSubscriptionToken } from 'inngest/react';
import { inngest } from '@/lib/inngest/client';
import { boardChannel, boardChannelTopics } from '@/lib/inngest/channels';

export async function getAdminBoardRealtimeToken(boardId: string) {
  await requireAdmin();
  return getClientSubscriptionToken(inngest, {
    channel: boardChannel({ boardId }),
    topics: [...boardChannelTopics],
  });
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/actions/admin-board-realtime.ts
git commit -m "feat(admin): add server action returning admin-gated board realtime token"
```

---

## Task 5: Add bulk retry API endpoint (TDD)

**Files:**
- Create: `app/api/admin/boards/[id]/retry-failed/route.ts`
- Test: `__tests__/api/admin-boards-retry-failed.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/admin-boards-retry-failed.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const selectMock = vi.fn();
const updateMock = vi.fn();
const sendMock = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (...args: unknown[]) => selectMock(...args),
      }),
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: (...args: unknown[]) => updateMock(values, ...args),
      }),
    }),
  },
  cards: { id: 'cards.id', boardId: 'cards.boardId', status: 'cards.status', originalImageUrl: 'cards.originalImageUrl', errorMessage: 'cards.errorMessage', userId: 'cards.userId' },
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: (...args: unknown[]) => sendMock(...args) },
}));

import { auth } from '@/lib/auth';
import { POST } from '@/app/api/admin/boards/[id]/retry-failed/route';

const ADMIN_SESSION = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };

function makeReq() {
  return new Request('http://localhost/api/admin/boards/B1/retry-failed', { method: 'POST' });
}

const params = Promise.resolve({ id: 'board-1' });

describe('POST /api/admin/boards/[id]/retry-failed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as any);
    selectMock.mockResolvedValue([]);
    updateMock.mockResolvedValue(undefined);
    sendMock.mockResolvedValue(undefined);
  });

  it('returns 404 when caller is not admin', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { email: 'someone@example.com' } } as any);
    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(404);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 0 when there are no errored cards', async () => {
    selectMock.mockResolvedValue([]);
    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ retriedCount: 0, cardIds: [] });
    expect(updateMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('flips errored cards to processing, sends one event per card, returns count and ids', async () => {
    selectMock.mockResolvedValue([
      { id: 'c1', userId: 'u1', originalImageUrl: 'https://blob/x', errorMessage: 'boom' },
      { id: 'c2', userId: 'u1', originalImageUrl: 'https://blob/y', errorMessage: 'kaboom' },
    ]);
    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ retriedCount: 2, cardIds: ['c1', 'c2'] });

    expect(updateMock).toHaveBeenCalledTimes(1);
    const [setValues] = updateMock.mock.calls[0];
    expect(setValues).toMatchObject({ status: 'processing', errorMessage: null });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [events] = sendMock.mock.calls[0];
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      name: 'card/illustration.regenerate',
      data: { cardId: 'c1', boardId: 'board-1', userId: 'u1', originalImageUrl: 'https://blob/x' },
    });
    expect(events[1].data.cardId).toBe('c2');
  });

  it('rolls each card back to error with original errorMessage when inngest.send throws', async () => {
    selectMock.mockResolvedValue([
      { id: 'c1', userId: 'u1', originalImageUrl: 'https://blob/x', errorMessage: 'original-1' },
      { id: 'c2', userId: 'u1', originalImageUrl: 'https://blob/y', errorMessage: 'original-2' },
    ]);
    sendMock.mockRejectedValue(new Error('inngest down'));

    const res = await POST(makeReq(), { params });
    expect(res.status).toBe(500);

    // 1 forward UPDATE + N rollback UPDATEs (one per card to preserve original errorMessage)
    expect(updateMock).toHaveBeenCalledTimes(3);
    const rollback1 = updateMock.mock.calls[1][0];
    expect(rollback1).toMatchObject({ status: 'error', errorMessage: 'original-1' });
    const rollback2 = updateMock.mock.calls[2][0];
    expect(rollback2).toMatchObject({ status: 'error', errorMessage: 'original-2' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test __tests__/api/admin-boards-retry-failed.test.ts`
Expected: FAIL — module `@/app/api/admin/boards/[id]/retry-failed/route` not found.

- [ ] **Step 3: Implement the API route**

Create `app/api/admin/boards/[id]/retry-failed/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { db, cards } from '@/db';
import { inngest } from '@/lib/inngest/client';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { id: boardId } = await params;

  const errored = await db
    .select({
      id: cards.id,
      userId: cards.userId,
      originalImageUrl: cards.originalImageUrl,
      errorMessage: cards.errorMessage,
    })
    .from(cards)
    .where(
      and(
        eq(cards.boardId, boardId),
        eq(cards.status, 'error'),
        isNotNull(cards.originalImageUrl)
      )
    );

  if (errored.length === 0) {
    return NextResponse.json({ retriedCount: 0, cardIds: [] });
  }

  const ids = errored.map((c) => c.id);

  await db
    .update(cards)
    .set({ status: 'processing', errorMessage: null, updatedAt: new Date() })
    .where(inArray(cards.id, ids));

  try {
    await inngest.send(
      errored.map((c) => ({
        name: 'card/illustration.regenerate' as const,
        data: {
          cardId: c.id,
          boardId,
          userId: c.userId,
          originalImageUrl: c.originalImageUrl!,
        },
      }))
    );
  } catch (err) {
    // Roll each card back individually so we restore its original errorMessage.
    for (const c of errored) {
      await db
        .update(cards)
        .set({ status: 'error', errorMessage: c.errorMessage, updatedAt: new Date() })
        .where(eq(cards.id, c.id));
    }
    return NextResponse.json(
      { error: 'Failed to enqueue retries', detail: (err as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({ retriedCount: ids.length, cardIds: ids });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test __tests__/api/admin-boards-retry-failed.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: PASS — no regressions.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/boards/[id]/retry-failed/route.ts __tests__/api/admin-boards-retry-failed.test.ts
git commit -m "feat(admin): add bulk retry-failed API endpoint with rollback on send failure"
```

---

## Task 6: Add RetryFailedButton client component

**Files:**
- Create: `app/(admin)/admin/components/retry-failed-button.tsx`

- [ ] **Step 1: Create the component**

Create `app/(admin)/admin/components/retry-failed-button.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function RetryFailedButton({
  boardId,
  errorCount,
}: {
  boardId: string;
  errorCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const disabled = errorCount === 0 || pending;

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/boards/${boardId}/retry-failed`, {
          method: 'POST',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        const { retriedCount } = (await res.json()) as { retriedCount: number };
        toast.success(`Re-queued ${retriedCount} card${retriedCount === 1 ? '' : 's'}`);
        router.refresh();
      } catch (err) {
        toast.error((err as Error).message || 'Failed to enqueue retries');
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
          {pending ? 'Sending…' : `Retry failed (${errorCount})`}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retry {errorCount} failed cards?</AlertDialogTitle>
          <AlertDialogDescription>
            This will overwrite each card&rsquo;s current state and re-run the illustration job.
            Cards that succeed will replace any previously errored output.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Retry {errorCount}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/components/retry-failed-button.tsx
git commit -m "feat(admin): add RetryFailedButton with confirmation dialog and toast feedback"
```

---

## Task 7: Add AdminBoardCardsGrid client component with realtime

**Files:**
- Create: `app/(admin)/admin/components/admin-board-cards-grid.tsx`

- [ ] **Step 1: Create the grid client component**

Create `app/(admin)/admin/components/admin-board-cards-grid.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRealtime } from 'inngest/react';
import { Badge } from '@/components/ui/badge';
import { boardChannel, boardChannelTopics } from '@/lib/inngest/channels';
import { getAdminBoardRealtimeToken } from '@/app/actions/admin-board-realtime';
import type { Card } from '@/db/schema';

export function AdminBoardCardsGrid({
  boardId,
  initialCards,
}: {
  boardId: string;
  initialCards: Card[];
}) {
  const [cards, setCards] = useState<Card[]>(initialCards);

  // Re-seed local state when the server hands us a new initialCards array
  // (e.g. after router.refresh() following the bulk retry POST).
  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const tokenFactory = useCallback(() => getAdminBoardRealtimeToken(boardId), [boardId]);

  const channel = useMemo(() => boardChannel({ boardId }), [boardId]);

  const { connectionStatus, messages } = useRealtime({
    channel,
    topics: boardChannelTopics,
    token: tokenFactory,
    bufferInterval: 0,
  });

  // Apply each new cardUpdated message to local state.
  useEffect(() => {
    const delta = messages.delta;
    if (!delta || delta.length === 0) return;
    setCards((prev) => {
      let next = prev;
      for (const m of delta) {
        if (m.topic !== 'cardUpdated') continue;
        const data = m.data as {
          cardId: string;
          status: Card['status'];
          illustrationUrl?: string;
          errorMessage?: string | null;
        };
        next = next.map((c) =>
          c.id === data.cardId
            ? {
                ...c,
                status: data.status,
                illustrationUrl: data.illustrationUrl ?? c.illustrationUrl,
                errorMessage:
                  data.errorMessage === undefined ? c.errorMessage : data.errorMessage,
              }
            : c
        );
      }
      return next;
    });
  }, [messages.delta]);

  const liveDisconnected = connectionStatus === 'error' || connectionStatus === 'closed';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Cards ({cards.length})</h3>
        {liveDisconnected && (
          <p className="text-xs text-muted-foreground">
            Live updates disconnected — refresh to see progress.
          </p>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cards</p>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={`/admin/cards/${card.id}`}
              className="group rounded-lg border border-border p-2 transition-colors hover:border-primary"
            >
              <div className="relative mb-2 aspect-[2/3] overflow-hidden rounded bg-muted">
                {card.illustrationUrl || card.originalImageUrl ? (
                  <Image
                    src={`/api/admin/images/${card.id}/${card.illustrationUrl ? 'illustration' : 'original'}`}
                    alt={card.label || `Card ${card.number}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
                {card.status === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
                    <Badge variant="destructive" className="text-[10px]">
                      Error
                    </Badge>
                  </div>
                )}
                {card.status === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                    <Badge variant="secondary" className="text-[10px]">
                      Processing…
                    </Badge>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs font-medium">#{card.number}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {card.label || 'Unlabeled'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/components/admin-board-cards-grid.tsx
git commit -m "feat(admin): add AdminBoardCardsGrid with board-level realtime subscription"
```

---

## Task 8: Wire components into admin board detail page

**Files:**
- Modify: `app/(admin)/admin/boards/[id]/page.tsx`

- [ ] **Step 1: Replace the page with the wired version**

Replace `app/(admin)/admin/boards/[id]/page.tsx` with:

```tsx
import { db, boards, cards, user } from '@/db';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminBreadcrumb } from '../../components/admin-breadcrumb';
import { RetryFailedButton } from '../../components/retry-failed-button';
import { AdminBoardCardsGrid } from '../../components/admin-board-cards-grid';
import Link from 'next/link';
import { IMAGE_GENERATION_LIMIT_FREE, IMAGE_GENERATION_LIMIT_PAID } from '@/db/schema';

async function getBoardWithOwner(boardId: string) {
  const result = await db
    .select({
      board: boards,
      ownerEmail: user.email,
      ownerId: user.id,
    })
    .from(boards)
    .innerJoin(user, eq(boards.userId, user.id))
    .where(eq(boards.id, boardId))
    .limit(1);

  return result[0] ?? null;
}

async function getBoardCards(boardId: string) {
  return db.select().from(cards).where(eq(cards.boardId, boardId)).orderBy(cards.number);
}

export default async function AdminBoardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, boardCards] = await Promise.all([getBoardWithOwner(id), getBoardCards(id)]);

  if (!data) {
    notFound();
  }

  const { board, ownerEmail, ownerId } = data;
  const genLimit = board.isUnlocked ? IMAGE_GENERATION_LIMIT_PAID : IMAGE_GENERATION_LIMIT_FREE;
  const errorCount = boardCards.filter((c) => c.status === 'error').length;

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        items={[
          { label: 'Users', href: '/admin/users' },
          { label: ownerEmail, href: `/admin/users/${ownerId}` },
          { label: board.name },
        ]}
      />

      {/* Board info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Board Info</CardTitle>
            <div className="flex items-center gap-2">
              <RetryFailedButton boardId={id} errorCount={errorCount} />
              {board.isUnlocked ? (
                <Badge variant="default">Unlocked</Badge>
              ) : (
                <Badge variant="secondary">Free</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Owner</p>
              <Link href={`/admin/users/${ownerId}`} className="hover:underline">
                {ownerEmail}
              </Link>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cards</p>
              <p>{boardCards.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Generations</p>
              <p>
                {board.imageGenerationsUsed}/{genLimit}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p>{board.createdAt.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p>{board.updatedAt.toLocaleDateString()}</p>
            </div>
            {board.stripePaymentId && (
              <div>
                <p className="text-xs text-muted-foreground">Stripe Payment ID</p>
                <p className="font-mono text-xs">{board.stripePaymentId}</p>
              </div>
            )}
          </div>
          {board.styleOptions && (
            <div>
              <p className="text-xs text-muted-foreground">Style Options</p>
              <pre className="mt-1 rounded bg-muted p-2 text-xs">
                {JSON.stringify(board.styleOptions, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards grid (client component with realtime subscription) */}
      <AdminBoardCardsGrid boardId={id} initialCards={boardCards} />
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/admin/boards/\[id\]/page.tsx
git commit -m "feat(admin): wire RetryFailedButton and live cards grid into board detail page"
```

---

## Task 9: Manual smoke test in dev

**Files:** none (verification only)

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`
Open: `http://localhost:3000` and sign in as `graham@stonecutterlabs.com`.

- [ ] **Step 2: Find a board with errored cards**

Navigate to `/admin/boards`. Pick a board where one or more cards show the red "Error" overlay (or use the per-card admin regenerate button to deliberately fail a card by temporarily breaking the worker, then revert).

- [ ] **Step 3: Verify the button**

On `/admin/boards/<id>`:
- The Board Info card header shows a `Retry failed (N)` button next to the Unlocked/Free badge.
- The button is disabled when `N = 0` and active otherwise.

- [ ] **Step 4: Click and confirm**

Click the button, confirm the dialog. Expect:
- Toast `"Re-queued N cards"`.
- Page refresh — those cards now show the `Processing…` badge (no more red Error overlay).

- [ ] **Step 5: Watch live updates**

Without manually refreshing, watch the grid as Inngest processes each card:
- `Processing…` overlay disappears once a card completes; the new illustration replaces the old image.
- If a card fails again, the Error overlay returns automatically.

- [ ] **Step 6: Verify failure path**

Stop the local Inngest dev server, click `Retry failed (N)` again, confirm. Expect:
- Toast surfaces an error message.
- Cards remain in `error` status with their original error message intact (verify by clicking through to the per-card admin page).

- [ ] **Step 7: Direct API call**

While signed in as admin (so the session cookie is set), in another shell:
```bash
curl -sS -X POST -b "<session-cookie>" http://localhost:3000/api/admin/boards/<board-id>/retry-failed | jq
```
Expect: `{ "retriedCount": <n>, "cardIds": [...] }`. While signed out (no cookie), expect `404 Not found`.

---

## Self-Review Notes

- **Spec coverage:** Endpoint (Task 5), button (Task 6), board channel (Task 1), publishes from both Inngest functions (Tasks 2–3), admin token action (Task 4), live grid (Task 7), page wiring (Task 8), tests (Task 5), manual smoke (Task 9). Optimistic update + rollback are in Task 5; "no errored cards → 0" path is in Task 5; "live updates disconnected" notice is in Task 7. All spec sections covered.
- **Type consistency:** `boardChannel({ boardId })` and `boardChannelTopics` are defined once in Task 1 and reused identically in Tasks 2, 3, 4, and 7. `cardUpdated` payload shape is defined in Task 1 and matched by every publish call and the grid's reducer. `RetryFailedButton` and `AdminBoardCardsGrid` prop names match between their definition (Tasks 6, 7) and consumption (Task 8).
- **Placeholder scan:** No "TBD" / "TODO" / "fill in" / vague handlers. Every code step shows the actual code. Manual smoke (Task 9) calls out exact UI strings to look for.
