'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const MAX_RIDDLE_LENGTH = 500;

/**
 * Admin-only: edit any user's card riddle inline. Riddles print on the caller
 * sheet. Saving an empty box clears the riddle.
 */
export function EditRiddleForm({
  cardId,
  cardNumber,
  riddle,
}: {
  cardId: string;
  cardNumber: number;
  riddle: string | null;
}) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const counterId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(riddle ?? '');
  const [saved, setSaved] = useState(riddle ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const dirty = trimmed !== saved;
  const tooLong = trimmed.length > MAX_RIDDLE_LENGTH;

  async function save() {
    if (tooLong) {
      setError(`Riddle must be ${MAX_RIDDLE_LENGTH} characters or fewer`);
      inputRef.current?.focus();
      return;
    }
    if (!dirty || saving) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cards/${cardId}/riddle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riddle: trimmed }),
      });
      if (!res.ok) throw new Error('Failed to save riddle');
      setSaved(trimmed);
      setValue(trimmed);
      toast.success(
        trimmed ? `Card #${cardNumber} riddle saved` : `Card #${cardNumber} riddle cleared`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save riddle');
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
          Riddle (caller sheet)
        </label>
        <span
          id={counterId}
          className={`text-xs tabular-nums ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {trimmed.length}/{MAX_RIDDLE_LENGTH}
        </span>
      </div>
      <textarea
        ref={inputRef}
        id={inputId}
        name="riddle"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
        rows={3}
        placeholder="e.g. Purrs on the porch, naps in the sun…"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${counterId} ${errorId}` : counterId}
        className="min-h-[4.5rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
      />
      {error && (
        <p id={errorId} role="alert" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={saving || !dirty}
        className="self-start"
      >
        {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        Save riddle
      </Button>
    </form>
  );
}
