'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const MAX_LABEL_LENGTH = 200;

interface EditLabelButtonProps {
  cardId: string;
  cardNumber: number;
  label: string;
  /** `icon` renders a small overlay button for the board grid. */
  variant?: 'button' | 'icon';
  className?: string;
  onSaved?: (label: string) => void;
}

/**
 * Admin-only: rename any user's card. A popover rather than the shadcn Dialog,
 * whose close button needs a next-intl provider the admin layout doesn't mount.
 */
export function EditLabelButton({
  cardId,
  cardNumber,
  label,
  variant = 'button',
  className,
  onSaved,
}: EditLabelButtonProps) {
  const router = useRouter();
  const inputId = useId();
  const titleId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (saving) return;
    setOpen(next);
    if (!next) setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get('label') ?? '').trim();
    if (!value) {
      setError('Label is required');
      inputRef.current?.focus();
      return;
    }
    if (value.length > MAX_LABEL_LENGTH) {
      setError(`Label must be ${MAX_LABEL_LENGTH} characters or fewer`);
      inputRef.current?.focus();
      return;
    }
    if (value === label) {
      setOpen(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cards/${cardId}/label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: value }),
      });
      if (!res.ok) throw new Error('Failed to save label');
      onSaved?.(value);
      setOpen(false);
      toast.success(`Card #${cardNumber} renamed`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save label');
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {variant === 'icon' ? (
          <button
            type="button"
            aria-label={`Edit label for card #${cardNumber}`}
            className={`flex size-6 items-center justify-center rounded bg-background/80 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className ?? ''}`}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
        ) : (
          <Button size="sm" variant="outline" className={className}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Edit label…
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" aria-labelledby={titleId} className="w-80">
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div className="space-y-1">
            <h4 id={titleId} className="text-sm font-semibold">
              Edit label — card #{cardNumber}
            </h4>
            <p className="text-xs text-muted-foreground">
              Printed on the card face. Changes the owner’s board too.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="sr-only">
              Label
            </label>
            <Input
              ref={inputRef}
              id={inputId}
              name="label"
              defaultValue={label}
              autoComplete="off"
              placeholder="El Gato…"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="text-base sm:text-sm"
            />
            {error && (
              <p id={errorId} role="alert" aria-live="polite" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
