'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function RegenerateButton({
  cardId,
  initialOverlay,
}: {
  cardId: string;
  initialOverlay?: string | null;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [overlay, setOverlay] = useState(initialOverlay ?? '');

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
        className="self-start"
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
