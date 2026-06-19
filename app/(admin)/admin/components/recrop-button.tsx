'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageCropModal } from './image-crop-modal';
import type { PixelRect } from '@/lib/crop-image';

interface RecropButtonProps {
  cardId: string;
  boardId: string;
  initialCrop: PixelRect | null;
}

export function RecropButton({ cardId, boardId, initialCrop }: RecropButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(rect: PixelRect) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/cards`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, cropData: rect }),
      });
      if (!res.ok) throw new Error('Failed to save crop');
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save crop');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={saving}
        className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        {saving ? 'Saving…' : 'Re-crop'}
      </button>
      {error && (
        <span role="alert" className="ml-2 text-sm text-primary">
          {error}
        </span>
      )}
      {open && (
        <ImageCropModal
          src={`/api/admin/images/${cardId}/original`}
          initialCrop={initialCrop ?? undefined}
          onSave={handleSave}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
