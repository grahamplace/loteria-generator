'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { filenameToLabel } from '@/lib/filename-label';

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

interface FileItem {
  file: File;
  label: string;
  status: FileStatus;
  error?: string;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AdminBulkUpload() {
  const router = useRouter();
  const [name, setName] = useState('Admin Board');
  const [useFilenameLabels, setUseFilenameLabels] = useState(true);
  const [items, setItems] = useState<FileItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const next: FileItem[] = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, label: filenameToLabel(file.name), status: 'pending' as const }));
    setItems(next);
    setError(null);
  }

  async function handleCreate() {
    if (items.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);

    let boardId: string;
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Admin Board' }),
      });
      if (!res.ok) throw new Error('Failed to create board');
      boardId = (await res.json()).board.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create board');
      setSubmitting(false);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it)));
      try {
        const base64 = await readAsDataUrl(items[i].file);
        const label = useFilenameLabels ? items[i].label : '';
        // If the toggle is on but the derived label is empty, fall back to AI.
        const skipLabeling = useFilenameLabels && label.length > 0;
        const res = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originalImageBase64: base64, label, skipLabeling }),
        });
        if (!res.ok) throw new Error('Upload failed');
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'done' } : it)));
      } catch (e) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: 'error', error: e instanceof Error ? e.message : 'failed' }
              : it
          )
        );
      }
    }

    router.push(`/admin/boards/${boardId}`);
  }

  return (
    <section className="mb-8 rounded-lg border border-foreground/10 bg-background p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Bulk create board</h2>

      <div className="mb-3 flex flex-col gap-1">
        <label htmlFor="bulk-board-name" className="text-sm font-medium text-foreground">
          Board name
        </label>
        <input
          id="bulk-board-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-foreground/20 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary"
          style={{ touchAction: 'manipulation' }}
        />
      </div>

      <label className="mb-3 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={useFilenameLabels}
          onChange={(e) => setUseFilenameLabels(e.target.checked)}
        />
        Use filename as label (skip AI labeling)
      </label>

      <div className="mb-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => onFilesSelected(e.target.files)}
          className="block text-sm"
        />
      </div>

      {items.length > 0 && (
        <ul className="mb-3 max-h-64 overflow-auto rounded-md border border-foreground/10 text-sm">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="min-w-0 truncate">{it.file.name}</span>
              <span className="shrink-0 text-foreground/60">
                {useFilenameLabels ? it.label || '(AI label)' : '(AI label)'} · {it.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mb-3 text-sm text-primary" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={items.length === 0 || submitting}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        {submitting ? 'Creating…' : 'Create board'}
      </button>
    </section>
  );
}
