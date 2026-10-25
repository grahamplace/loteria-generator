'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Shown on a board its owner deleted; restoring puts it back in their list. */
export function RestoreBoardButton({ boardId }: { boardId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function restore() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/boards/${boardId}/restore`, { method: 'POST' });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        toast.success('Board restored');
        router.refresh();
      } catch (err) {
        toast.error((err as Error).message || 'Failed to restore board');
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={restore} disabled={pending}>
      <Undo2 className="mr-1.5 h-3.5 w-3.5" />
      {pending ? 'Restoring…' : 'Restore'}
    </Button>
  );
}
