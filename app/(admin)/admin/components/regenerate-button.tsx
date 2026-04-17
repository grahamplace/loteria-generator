'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function RegenerateButton({ cardId }: { cardId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');

  async function handleRegenerate() {
    setState('loading');
    try {
      const res = await fetch(`/api/admin/cards/${cardId}/regenerate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to trigger regeneration');
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRegenerate}
      disabled={state === 'loading' || state === 'sent'}
    >
      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} />
      {state === 'idle' && 'Regenerate illustration'}
      {state === 'loading' && 'Sending…'}
      {state === 'sent' && 'Regeneration queued'}
      {state === 'error' && 'Failed — try again'}
    </Button>
  );
}
