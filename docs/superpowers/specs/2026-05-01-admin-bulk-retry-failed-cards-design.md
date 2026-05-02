# Admin: Bulk Retry Failed Cards on a Board

## Goal

Give admins a one-click way (and a callable endpoint) to re-queue every card on a single board whose illustration generation ended in `error`, and watch the cards update live as Inngest finishes each one.

## Scope

- **In scope:** retry only cards with `status = 'error'` on a single board, triggered from the admin board detail page or via the API directly. Live updates to the admin board page via a new board-level Inngest realtime channel.
- **Out of scope:** retrying `pending`/`processing`/`completed` cards in bulk, retries spanning multiple boards, user-facing realtime, retry rate-limiting beyond what Inngest already enforces.

## Background

Today the admin board detail page (`app/(admin)/admin/boards/[id]/page.tsx`) renders all cards as a static grid. There is a per-card regenerate endpoint (`app/api/admin/cards/[cardId]/regenerate/route.ts`) that fires the existing `card/illustration.regenerate` Inngest event, picked up by `regenerateIllustration` in `lib/inngest/functions/regenerate-illustration.ts`. That function is already serialized per user (`concurrency: { key: 'event.data.userId', limit: 1 }`).

Realtime infrastructure is partly in place: `lib/inngest/channels.ts` defines a per-card `cardChannel`, and `app/actions/card-realtime.ts` hands out subscription tokens for it. Nothing in the app currently consumes those tokens client-side — this feature will be the first.

## Decisions

| Question | Choice | Reasoning |
|---|---|---|
| Which cards? | `status = 'error'` only | Per-card button already covers single retries; `error` is the actionable bulk case. |
| Trigger surface | Admin button **and** API endpoint | Button calls the same endpoint, so "programmatic" use (curl/scripts) and one-click use share one code path. |
| Post-click feedback | Optimistic DB write **and** live updates | Optimistic write makes the page honest after refresh; live updates so the admin doesn't have to reload. |
| Realtime architecture | Board-level channel | One subscription per page instead of N per-card subscriptions; reusable later for non-admin views. |

## Architecture

### New API endpoint

`POST /api/admin/boards/[id]/retry-failed`

1. `requireAdmin` (existing helper from `lib/admin.ts`).
2. Select errored cards with original images (also capture `error_message` for rollback):
   ```sql
   SELECT id, user_id, original_image_url, error_message
   FROM cards
   WHERE board_id = $1
     AND status = 'error'
     AND original_image_url IS NOT NULL;
   ```
3. If empty, return `{ retriedCount: 0, cardIds: [] }` with 200.
4. Optimistically flip those cards to `processing`:
   ```sql
   UPDATE cards
   SET status = 'processing', error_message = NULL, updated_at = now()
   WHERE id = ANY($1);
   ```
5. Fan out the existing event in one batch:
   ```ts
   await inngest.send(
     errored.map((c) => ({
       name: 'card/illustration.regenerate',
       data: {
         cardId: c.id,
         boardId,
         userId: c.userId,
         originalImageUrl: c.originalImageUrl!,
       },
     })),
   );
   ```
6. If `inngest.send` throws, revert the affected ids back to `error` (with the original `errorMessage` preserved by reading them in step 2), then return 500 with `{ error: 'Failed to enqueue retries' }`.
7. On success, return `{ retriedCount, cardIds }`.

### New board-level realtime channel

In `lib/inngest/channels.ts`:

```ts
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

Both Inngest functions publish to this channel in addition to their existing per-card publishes:

- `regenerateIllustration` — publishes `cardUpdated` with `status: 'processing'` from `set-processing`, then `status: 'completed', illustrationUrl` after `persist-illustration`. The `onFailure` handler also publishes `status: 'error', errorMessage`.
- `generateCardArtwork` — same pattern at the same lifecycle points (so admins watching during initial generation see updates too).

Per-card publishes remain unchanged so existing/future per-card consumers keep working.

### New admin server action

`app/actions/admin-board-realtime.ts`:

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

### Page changes

`app/(admin)/admin/boards/[id]/page.tsx` (server component) computes `errorCount` from the cards query and:

- Renders `<RetryFailedButton boardId={id} errorCount={errorCount} />` in the Board Info card.
- Replaces the inlined cards grid with `<AdminBoardCardsGrid boardId={id} initialCards={boardCards} />`.

### New client components

**`app/(admin)/admin/components/retry-failed-button.tsx`**
- Disabled when `errorCount === 0`. Label: `Retry failed (N)`.
- On click, opens a shadcn `AlertDialog`: "Retry N failed cards? This will overwrite their current state."
- On confirm, `POST`s to the endpoint, shows toast `"Re-queued N cards"` (or error toast on failure), then `router.refresh()`.

**`app/(admin)/admin/components/admin-board-cards-grid.tsx`**
- Receives `initialCards` and `boardId`.
- Holds `cards` in `useState`, seeded from `initialCards`.
- Calls `useInngestSubscription({ refreshToken: () => getAdminBoardRealtimeToken(boardId), bufferInterval: 0 })`.
- For each `cardUpdated` event, patches the matching card in local state (status, illustrationUrl, errorMessage).
- Renders the same markup currently in the page (cards grid linking to `/admin/cards/[id]`).
- If the subscription enters an error state, shows a small inline notice: "Live updates disconnected — refresh to see progress."

## Data Flow

```
Admin clicks "Retry N" → confirms in dialog
  → POST /api/admin/boards/[id]/retry-failed
      requireAdmin → SELECT errored cards
                  → UPDATE status='processing'
                  → inngest.send([N events])
                  → { retriedCount, cardIds }
  → toast "Re-queued N", router.refresh()
  → grid re-renders with cards now in 'processing'

Inngest worker (serialized per userId):
  regenerateIllustration runs
    set-processing                → publish boardChannel.cardUpdated{processing}
    generate-and-upload           (long step)
    persist-illustration          → publish boardChannel.cardUpdated{completed, url}
                                  → publish cardChannel.illustration (existing)
  on failure:
    persist-error                 → publish boardChannel.cardUpdated{error, message}
                                  → publish cardChannel.error (existing)

AdminBoardCardsGrid receives boardChannel.cardUpdated
  → patches matching card in local state
  → grid updates without reload
```

## Error Handling

- **No errored cards on the board:** endpoint returns `retriedCount: 0`. Button is also disabled in this state, but the endpoint stays safe for direct callers.
- **`inngest.send` failure after optimistic update:** revert affected card ids back to `error` with their original `errorMessage` (captured in step 2), return 500. Client surfaces toast `"Failed to enqueue retries"`.
- **Worker failure:** existing `onFailure` handler in `regenerateIllustration` already persists `status='error'` and publishes per-card error. Add `boardChannel.cardUpdated` publish there so the admin grid reflects the failure live.
- **Subscription drop:** grid keeps last server-rendered state, shows a "live updates disconnected" notice. Manual refresh recovers.

## Files Touched

**New**
- `app/api/admin/boards/[id]/retry-failed/route.ts`
- `app/actions/admin-board-realtime.ts`
- `app/(admin)/admin/components/retry-failed-button.tsx`
- `app/(admin)/admin/components/admin-board-cards-grid.tsx`
- `__tests__/app/api/admin/boards/retry-failed.test.ts`

**Modified**
- `lib/inngest/channels.ts` — add `boardChannel`, `boardChannelTopics`.
- `lib/inngest/functions/regenerate-illustration.ts` — publish to `boardChannel` in success path and `onFailure`.
- `lib/inngest/functions/generate-card-artwork.ts` — publish to `boardChannel` at the same lifecycle points.
- `app/(admin)/admin/boards/[id]/page.tsx` — compute `errorCount`, render new button, swap grid for client component.

## Testing

API route unit tests (vitest):
- 404 when caller is not admin.
- Returns `{ retriedCount: 0 }` when no errored cards.
- Updates only matching cards to `processing`, sends one event per errored card with the right payload, returns the count and ids.
- Rolls status back to `error` (with original `errorMessage`) when `inngest.send` throws.

No realtime end-to-end test — nothing else in the repo tests Inngest realtime, and the channel/publish change is small and verifiable by manual smoke.

## Open Risks

- The admin board page currently has no client-side suspense boundary; introducing the subscription means the grid becomes a client component. The row that loads board info stays server-rendered, so paint cost shouldn't change.
- `boardChannel` publishes from the Inngest functions are additive; a publish failure must not fail the underlying generation. The existing per-card publishes already use `step.realtime.publish`, which is retried/isolated by the step runner — the new `boardChannel` publishes follow the same pattern at the same lifecycle points.
