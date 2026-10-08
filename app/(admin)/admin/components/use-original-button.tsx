'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Switch an AI-illustrated card to its uploaded photo. Two-step inline
 * confirm: the AI drawing is no longer referenced afterwards, and getting it
 * back means paying for a new generation.
 */
export function UseOriginalButton({ cardId, className }: { cardId: string; className?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // Move focus into the confirm step, and back to the trigger on cancel.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (wasConfirming.current) triggerRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  function cancel() {
    setConfirming(false);
    setError(null);
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cards/${cardId}/use-original`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to use original photo');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to use original photo');
    } finally {
      setSaving(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        ref={triggerRef}
        size="sm"
        variant="outline"
        onClick={() => setConfirming(true)}
        className={className}
      >
        <ImageIcon aria-hidden="true" />
        Use photo
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Use photo"
      // Full row: the confirm step needs more room than the trigger it replaces.
      className="flex w-full flex-wrap items-center gap-2 rounded-md border border-secondary/40 bg-secondary/10 px-2 py-1"
    >
      <span className="text-sm text-foreground">Discard AI drawing?</span>
      <Button ref={confirmRef} size="sm" onClick={handleConfirm} disabled={saving}>
        {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
        Cancel
      </Button>
      {error && (
        <span role="alert" aria-live="polite" className="text-sm text-primary">
          {error}
        </span>
      )}
    </div>
  );
}
