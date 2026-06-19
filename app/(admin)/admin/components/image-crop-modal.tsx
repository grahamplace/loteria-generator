'use client';

import { useEffect, useRef, useState } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { scaleCropToNatural, type PixelRect } from '@/lib/crop-image';

interface ImageCropModalProps {
  src: string;
  initialCrop?: PixelRect;
  onSave: (rect: PixelRect) => void;
  onCancel: () => void;
}

export function ImageCropModal({ src, initialCrop, onSave, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop | undefined>(
    initialCrop ? { unit: 'px', ...initialCrop } : undefined
  );
  const [completed, setCompleted] = useState<PixelCrop | undefined>(
    initialCrop ? { unit: 'px', ...initialCrop } : undefined
  );
  const imgRef = useRef<HTMLImageElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on open and close it on Escape (APG dialog basics).
  useEffect(() => {
    panelRef.current?.focus();
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function handleSave() {
    const img = imgRef.current;
    if (!img || !completed || completed.width === 0 || completed.height === 0) {
      onCancel();
      return;
    }
    const rect = scaleCropToNatural(
      { x: completed.x, y: completed.y, width: completed.width, height: completed.height },
      {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: img.width,
        displayHeight: img.height,
      }
    );
    onSave(rect);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[90vh] max-w-2xl overflow-auto rounded-lg bg-background p-4 shadow-lg focus:outline-none"
      >
        <h3 className="mb-2 text-base font-semibold text-foreground">Crop image</h3>
        <p className="mb-3 text-sm text-foreground/60">
          Drag to select the part of the photo to use. Cancel to keep the full image.
        </p>
        <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompleted(c)}>
          {/* react-image-crop requires a raw <img> child */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={src} alt="" className="max-h-[60vh] w-auto" />
        </ReactCrop>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            style={{ touchAction: 'manipulation' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-primary"
            style={{ touchAction: 'manipulation' }}
          >
            Save crop
          </button>
        </div>
      </div>
    </div>
  );
}
