'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export function GenerationLimitForm({
  boardId,
  override,
}: {
  boardId: string;
  override: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save(limit: number | null) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/boards/${boardId}/generation-limit`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        toast.success(limit === null ? 'Limit override cleared' : `Limit set to ${limit}`);
        router.refresh();
      } catch (err) {
        toast.error((err as Error).message || 'Failed to update limit');
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get('limit') ?? '').trim();
    const limit = Number(raw);
    if (raw === '' || !Number.isInteger(limit) || limit < 0) {
      toast.error('Enter a whole number, 0 or more');
      return;
    }
    save(limit);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex items-center gap-1.5">
      <Input
        key={override ?? 'none'}
        name="limit"
        type="number"
        inputMode="numeric"
        min={0}
        defaultValue={override ?? ''}
        placeholder="Override…"
        aria-label="Generation limit override"
        className="h-8 w-24 text-base sm:text-xs"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending && <Spinner className="mr-1 h-3 w-3" />}
        Set
      </Button>
      {override !== null && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => save(null)}
        >
          Clear
        </Button>
      )}
    </form>
  );
}
