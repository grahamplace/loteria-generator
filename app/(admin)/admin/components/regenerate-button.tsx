'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtime } from 'inngest/react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { boardChannel, boardChannelTopics, type CardUpdatedPayload } from '@/lib/inngest/channels';
import { getAdminBoardRealtimeToken } from '@/app/actions/admin-board-realtime';

type RegenerateState = 'idle' | 'loading' | 'sent' | 'error';

export function RegenerateButton({
  cardId,
  boardId,
  initialOverlay,
}: {
  cardId: string;
  boardId: string;
  initialOverlay?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<RegenerateState>('idle');
  const [overlay, setOverlay] = useState(initialOverlay ?? '');

  // Read inside the realtime effect without re-running it on every state
  // change, which would re-apply a stale delta.
  const stateRef = useRef(state);
  stateRef.current = state;

  const tokenFactory = useCallback(() => getAdminBoardRealtimeToken(boardId), [boardId]);
  const channel = useMemo(() => boardChannel({ boardId }), [boardId]);
  const { messages } = useRealtime({
    channel,
    topics: boardChannelTopics,
    token: tokenFactory,
    bufferInterval: 0,
    // Only listen while a regeneration is pending. Keep listening when the tab
    // is hidden: regeneration takes ~45s and admins switch tabs meanwhile; a
    // paused subscription would miss the completion and stay "queued".
    enabled: state === 'sent',
    pauseOnHidden: false,
  });

  // Once the queued regeneration finishes, refresh so the page picks up the
  // new image (its src is versioned by updatedAt) — no hard reload needed.
  useEffect(() => {
    if (stateRef.current !== 'sent') return;
    const delta = messages.delta;
    if (!delta || delta.length === 0) return;
    for (const m of delta) {
      if (m.topic !== 'cardUpdated') continue;
      const { cardId: updatedId, status } = m.data as CardUpdatedPayload;
      if (updatedId !== cardId) continue;
      if (status === 'completed' || status === 'error') {
        setState(status === 'completed' ? 'idle' : 'error');
        router.refresh();
        return;
      }
    }
  }, [messages.delta, cardId, router]);

  async function handleRegenerate() {
    setState('loading');
    try {
      const res = await fetch(`/api/admin/cards/${cardId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptOverlay: overlay }),
      });
      if (!res.ok) throw new Error('Failed to trigger regeneration');
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`overlay-${cardId}`} className="text-xs font-medium text-muted-foreground">
        Extra instructions (optional)
      </label>
      <textarea
        id={`overlay-${cardId}`}
        value={overlay}
        onChange={(e) => {
          setOverlay(e.target.value);
          if (state === 'sent' || state === 'error') setState('idle');
        }}
        rows={3}
        placeholder="e.g. Make the background a flat blue field…"
        className="min-h-[4.5rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleRegenerate}
        disabled={state === 'loading' || state === 'sent'}
        className="w-full"
      >
        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} />
        {state === 'idle' && 'Regenerate illustration'}
        {state === 'loading' && 'Sending…'}
        {state === 'sent' && 'Regeneration queued'}
        {state === 'error' && 'Failed — try again'}
      </Button>
    </div>
  );
}
