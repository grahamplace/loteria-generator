'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageCropModal } from './image-crop-modal';
import type { PixelRect } from '@/lib/crop-image';

interface RecropButtonProps {
  cardId: string;
  boardId: string;
  initialCrop: PixelRect | null;
  className?: string;
}

export function RecropButton({ cardId, boardId, initialCrop, className }: RecropButtonProps) {
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
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={saving}
        className={className}
      >
        <Crop aria-hidden="true" />
        {saving ? 'Saving…' : 'Re-crop'}
      </Button>
      {error && (
        <span role="alert" className="w-full text-sm text-primary">
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
