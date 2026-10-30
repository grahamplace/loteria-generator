'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Delete a card from its owner's board. Two-step inline confirm: deletion
 * removes the card's images and can't be undone.
 *
 * Without `onDeleted` (the standalone card page) it navigates to the board.
 */
export function DeleteCardButton({
  cardId,
  boardId,
  cardNumber,
  onDeleted,
}: {
  cardId: string;
  boardId: string;
  cardNumber: number;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cards/${cardId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete card');
      if (onDeleted) {
        onDeleted();
        router.refresh();
      } else {
        router.replace(`/admin/boards/${boardId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete card');
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        ref={triggerRef}
        size="sm"
        variant="outline"
        onClick={() => setConfirming(true)}
        className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 aria-hidden="true" />
        Delete card
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Delete card #${cardNumber}`}
      className="flex w-full flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1"
    >
      <span className="text-sm text-foreground">Delete card #{cardNumber}?</span>
      <Button
        ref={confirmRef}
        size="sm"
        variant="destructive"
        onClick={handleConfirm}
        disabled={deleting}
      >
        {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        Delete
      </Button>
      <Button size="sm" variant="ghost" onClick={cancel} disabled={deleting}>
        Cancel
      </Button>
      {error && (
        <span role="alert" aria-live="polite" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
