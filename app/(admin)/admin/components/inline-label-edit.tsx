'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const MAX_LABEL_LENGTH = 200;

/**
 * Admin-only: the card heading, `#26 — La Margarita`, where clicking the label
 * edits it in place. Blur or Enter saves; Escape cancels. An empty or
 * over-long label is rejected and the previous one restored.
 */
export function InlineLabelEdit({
  cardId,
  cardNumber,
  label,
  onSaved,
}: {
  cardId: string;
  cardNumber: number;
  label: string;
  onSaved?: (label: string) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Shown optimistically while the save is in flight.
  const [display, setDisplay] = useState(label);
  // Set by Escape so the blur that follows doesn't save.
  const cancelled = useRef(false);

  useEffect(() => {
    if (!saving) setDisplay(label);
  }, [label, saving]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit(raw: string) {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const value = raw.trim();
    if (value === label) return;
    if (!value) {
      toast.error('Label can’t be empty — kept the previous one');
      return;
    }
    if (value.length > MAX_LABEL_LENGTH) {
      toast.error(`Label must be ${MAX_LABEL_LENGTH} characters or fewer`);
      return;
    }

    setDisplay(value);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/cards/${cardId}/label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: value }),
      });
      if (!res.ok) throw new Error('Failed to save label');
      onSaved?.(value);
      toast.success(`#${cardNumber} renamed`);
      router.refresh();
    } catch {
      setDisplay(label);
      toast.error(`Couldn’t rename #${cardNumber}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <h2 className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium">
      <span className="shrink-0 tabular-nums text-muted-foreground">#{cardNumber} —</span>
      {editing ? (
        <input
          ref={inputRef}
          defaultValue={label}
          aria-label={`Label for card #${cardNumber}`}
          autoComplete="off"
          spellCheck={false}
          // Lets the card modal know this field handles Escape itself.
          data-escape-handled=""
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              cancelled.current = true;
              e.currentTarget.blur();
            }
          }}
          className="-my-1 min-w-0 flex-1 rounded border border-input bg-background px-1.5 py-1 text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={saving}
          title="Click to rename"
          aria-label={`${display || 'Unlabeled'} — rename card #${cardNumber}`}
          className="-mx-1.5 -my-1 min-w-0 truncate rounded px-1.5 py-1 text-left hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
        >
          {display || 'Unlabeled'}
        </button>
      )}
    </h2>
  );
}
