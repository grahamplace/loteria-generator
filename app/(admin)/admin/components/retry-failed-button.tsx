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
