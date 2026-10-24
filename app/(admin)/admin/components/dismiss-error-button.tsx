'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

async function setDismissed(cardId: string, dismissed: boolean) {
  const res = await fetch(`/api/admin/cards/${cardId}/dismiss-error`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dismissed }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
}

export function DismissErrorButton({ cardId, cardNumber }: { cardId: string; cardNumber: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDismiss() {
    startTransition(async () => {
      try {
        await setDismissed(cardId, true);
        router.refresh();
        toast.success(`Dismissed error on card #${cardNumber}`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await setDismissed(cardId, false);
                router.refresh();
              } catch (err) {
                toast.error((err as Error).message || 'Failed to undo');
              }
            },
          },
        });
      } catch (err) {
        toast.error((err as Error).message || 'Failed to dismiss error');
      }
    });
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-7"
      disabled={pending}
      onClick={handleDismiss}
      aria-label={`Dismiss error on card #${cardNumber}`}
      title="Dismiss"
    >
      <X className="size-3.5" />
    </Button>
  );
}
