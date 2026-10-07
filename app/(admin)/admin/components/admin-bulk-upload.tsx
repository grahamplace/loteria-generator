'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { filenameToLabel } from '@/lib/filename-label';
import { type PixelRect } from '@/lib/crop-image';
import { downscaleToDataUrl } from '@/lib/downscale-image';
import {
  CONVERTIBLE_IMAGE_ACCEPT,
  convertForUpload,
  convertibleKind,
  isUploadCandidate,
} from '@/lib/convert-upload-image';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { scaleRect } from '@/lib/crop-math';
import { describeUploadFailure, requestBodyLimitError } from '@/lib/upload-limits';
import { ImageCropModal } from './image-crop-modal';

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

interface FileItem {
  file: File;
  label: string;
  status: FileStatus;
  error?: string;
  crop?: PixelRect;
  // Use the photo as-is instead of turning it into an AI drawing.
  keepPhoto: boolean;
  previewUrl: string;
}

interface UploadResult {
  boardId: string;
  succeeded: number;
}

export function AdminBulkUpload() {
  const router = useRouter();
  const [name, setName] = useState('Admin Board');
  const [useFilenameLabels, setUseFilenameLabels] = useState(true);
  const [reIllustrate, setReIllustrate] = useState(false);
  const [items, setItems] = useState<FileItem[]>([]);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  // Revoke any outstanding preview object URLs when the component unmounts
  // (e.g. after navigating to the new board). Re-selection revokes the prior
  // batch inline in onFilesSelected.
  const itemsRef = useRef<FileItem[]>([]);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl)), []);

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const selected = Array.from(fileList).filter(isUploadCandidate);
    let files = selected;
    let unreadable: File[] = [];
    // Await only when converting, so ordinary files update state synchronously.
    if (selected.some((f) => convertibleKind(f))) {
      const results = await Promise.allSettled(selected.map(convertForUpload));
      files = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      unreadable = selected.filter((_, i) => results[i].status === 'rejected');
    }
    setItems((prev) => {
      prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return files.map((file) => ({
        file,
        label: filenameToLabel(file.name),
        status: 'pending' as const,
        keepPhoto: !reIllustrate,
        previewUrl: URL.createObjectURL(file),
      }));
    });
    setError(
      unreadable.length > 0
        ? `Couldn’t read ${unreadable.map((f) => f.name).join(', ')}. Save as JPG and retry.`
        : null
    );
    setResult(null);
  }

  // The batch checkbox sets every image; per-image toggles override it after.
  function setReIllustrateAll(checked: boolean) {
    setReIllustrate(checked);
    setItems((prev) => prev.map((it) => ({ ...it, keepPhoto: !checked })));
  }

  function toggleKeepPhoto(index: number) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, keepPhoto: !it.keepPhoto } : it))
    );
  }

  function saveCrop(rect: PixelRect) {
    setItems((prev) => prev.map((it, idx) => (idx === cropIndex ? { ...it, crop: rect } : it)));
    setCropIndex(null);
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

    let succeeded = 0;
    for (let i = 0; i < items.length; i++) {
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it)));
      try {
        const item = items[i];
        const { dataUrl, scale } = await downscaleToDataUrl(item.file, 2048);
        const cropData = item.crop ? scaleRect(item.crop, scale) : undefined;
        const label = useFilenameLabels ? item.label : '';
        // If the toggle is on but the derived label is empty, fall back to AI.
        const skipLabeling = useFilenameLabels && label.length > 0;
        const body = JSON.stringify({
          originalImageBase64: dataUrl,
          label,
          skipLabeling,
          skipIllustration: item.keepPhoto,
          cropData,
        });
        // Vercel answers an oversized body with a bare 413 before our handler
        // runs. Check first so the failure names the size instead.
        const sizeError = requestBodyLimitError(new Blob([body]).size);
        if (sizeError) throw new Error(sizeError);
        // A long batch is likely to hit a Wi-Fi blip somewhere; retry dropped
        // connections so one blip doesn't lose the card.
        const res = await fetchWithRetry(`/api/boards/${boardId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (!res.ok) {
          const resBody = await res.json().catch(() => null);
          throw new Error(describeUploadFailure(res.status, resBody));
        }
        succeeded++;
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

    if (succeeded === items.length) {
      router.push(`/admin/boards/${boardId}`);
      return;
    }
    // Stay on the page when anything failed: redirecting would hide which
    // files were dropped and why.
    setResult({ boardId, succeeded });
    setSubmitting(false);
  }

  const failed = items.filter((it) => it.status === 'error');
  const photoCount = items.filter((it) => it.keepPhoto).length;

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

      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={reIllustrate}
            onChange={(e) => setReIllustrateAll(e.target.checked)}
          />
          Re-illustrate with AI
        </label>
        {items.length > 0 && (
          <span className="text-xs text-foreground/60 [font-variant-numeric:tabular-nums]">
            {items.length - photoCount} AI · {photoCount} photo
          </span>
        )}
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
          type="file"
          multiple
          accept={`image/*,${CONVERTIBLE_IMAGE_ACCEPT}`}
          onChange={(e) => onFilesSelected(e.target.files)}
          className="block w-full text-sm text-foreground/70 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary/90 file:[touch-action:manipulation]"
        />
      </div>

      {items.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {items.map((it, idx) => (
            <div key={idx} className="flex min-w-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => setCropIndex(idx)}
                className="group relative overflow-hidden rounded-md border border-foreground/10 focus-visible:outline-2 focus-visible:outline-primary"
                style={{ touchAction: 'manipulation' }}
                title={
                  it.error ? `${it.file.name} — ${it.error}` : `${it.file.name} — click to crop`
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.previewUrl}
                  alt={it.file.name}
                  className="aspect-[2/3] w-full object-cover"
                />
                {it.crop && (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    cropped
                  </span>
                )}
                {it.status === 'error' ? (
                  <span className="absolute right-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    failed
                  </span>
                ) : (
                  it.keepPhoto && (
                    <span className="absolute right-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      photo
                    </span>
                  )
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
                  {useFilenameLabels ? it.label || '(AI label)' : '(AI label)'} · {it.status}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={it.keepPhoto}
                aria-label={`Keep as photo: ${it.file.name}`}
                onClick={() => toggleKeepPhoto(idx)}
                disabled={submitting}
                className={`min-h-6 rounded-md border px-2 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${
                  it.keepPhoto
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-foreground/20 text-foreground/70 hover:bg-foreground/5'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                {it.keepPhoto ? 'Photo' : 'AI drawing'}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mb-3 text-sm text-primary" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      {result && failed.length > 0 && (
        <div
          className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground"
          role="alert"
          aria-live="polite"
        >
          <p className="font-semibold text-primary">
            {failed.length} of {items.length} {items.length === 1 ? 'file' : 'files'} failed to
            upload
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {failed.map((it) => (
              <li key={it.previewUrl} className="break-words">
                <span className="font-medium">{it.file.name}</span>: {it.error}
              </li>
            ))}
          </ul>
          {result.succeeded > 0 ? (
            <Link
              href={`/admin/boards/${result.boardId}`}
              className="mt-2 inline-block font-semibold text-primary hover:underline"
            >
              Open board ({result.succeeded} {result.succeeded === 1 ? 'card' : 'cards'} uploaded)
            </Link>
          ) : (
            <p className="mt-2">The board was created but has no cards.</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={items.length === 0 || submitting || result !== null}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        {submitting ? 'Creating…' : 'Create board'}
      </button>

      {cropIndex !== null && items[cropIndex] && (
        <ImageCropModal
          src={items[cropIndex].previewUrl}
          initialCrop={items[cropIndex].crop}
          onSave={saveCrop}
          onCancel={() => setCropIndex(null)}
        />
      )}
    </section>
  );
}
