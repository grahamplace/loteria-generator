'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Match the server-side base64 cap (~10MB decoded).
const MAX_BYTES = 10 * 1024 * 1024;

interface ReplaceIllustrationButtonProps {
  cardId: string;
}

export function ReplaceIllustrationButton({ cardId }: ReplaceIllustrationButtonProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError('Image exceeds maximum size of 10MB');
      return;
    }
    setError(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function close() {
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setFile(null);
    setError(null);
  }

  async function handleReplace() {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/admin/cards/${cardId}/illustration`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ illustrationBase64: dataUrl }),
      });
      if (!res.ok) throw new Error('Failed to replace illustration');
      close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to replace illustration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <label
        className="inline-flex cursor-pointer items-center rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-foreground/5 focus-within:outline-2 focus-within:outline-primary"
        style={{ touchAction: 'manipulation' }}
      >
        Replace illustration…
        <input type="file" accept="image/*" onChange={onSelect} className="sr-only" />
      </label>
      {error && !file && (
        <span role="alert" className="ml-2 text-sm text-primary">
          {error}
        </span>
      )}
      {file && previewUrl && (
        <ConfirmModal
          previewUrl={previewUrl}
          fileName={file.name}
          saving={saving}
          error={error}
          onConfirm={handleReplace}
          onCancel={close}
        />
      )}
    </>
  );
}

interface ConfirmModalProps {
  previewUrl: string;
  fileName: string;
  saving: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  previewUrl,
  fileName,
  saving,
  error,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        onCancel();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [onCancel, saving]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ overscrollBehavior: 'contain' }}
      onClick={() => !saving && onCancel()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Replace illustration"
        className="w-full max-w-sm rounded-lg border border-foreground/10 bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-foreground">Replace illustration?</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This overwrites the current illustration with the uploaded image, used as-is. No AI is
          run.
        </p>
        <div className="mt-3 overflow-hidden rounded border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={fileName} className="mx-auto max-h-64 w-auto object-contain" />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-primary">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
            style={{ touchAction: 'manipulation' }}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
            style={{ touchAction: 'manipulation' }}
          >
            {saving ? 'Replacing…' : 'Replace'}
          </button>
        </div>
      </div>
    </div>
  );
}
