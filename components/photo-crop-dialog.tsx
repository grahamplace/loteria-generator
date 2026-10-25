'use client';
import { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { scaleCropToNatural, type PixelRect } from '@/lib/crop-image';

export function PhotoCropDialog({
  src,
  initialCrop,
  onSave,
  onClose,
}: {
  src: string;
  initialCrop?: PixelRect | null;
  onSave: (crop: PixelRect | null) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations('Themes.Builder');
  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PixelCrop>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const image = useRef<HTMLImageElement>(null);
  async function save(reset = false) {
    if (!reset && (!completed || !image.current)) return;
    setSaving(true);
    setError('');
    try {
      const rect = reset
        ? null
        : scaleCropToNatural(completed!, {
            naturalWidth: image.current!.naturalWidth,
            naturalHeight: image.current!.naturalHeight,
            displayWidth: image.current!.width,
            displayHeight: image.current!.height,
          });
      if (rect && (rect.width < 1 || rect.height < 1)) throw new Error('Empty crop');
      await onSave(rect);
      onClose();
    } catch {
      setError(t('saveError'));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('crop')}</DialogTitle>
          <DialogDescription>{t('cropHint')}</DialogDescription>
        </DialogHeader>
        <ReactCrop crop={crop} onChange={setCrop} onComplete={setCompleted} aspect={2 / 3}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={image}
            src={src}
            alt={t('original')}
            className="max-h-[60vh] w-auto"
            onLoad={(event) => {
              const img = event.currentTarget;
              const selection: Crop = initialCrop
                ? {
                    unit: '%',
                    x: (initialCrop.x / img.naturalWidth) * 100,
                    y: (initialCrop.y / img.naturalHeight) * 100,
                    width: (initialCrop.width / img.naturalWidth) * 100,
                    height: (initialCrop.height / img.naturalHeight) * 100,
                  }
                : centerCrop(
                    makeAspectCrop({ unit: '%', width: 90 }, 2 / 3, img.width, img.height),
                    img.width,
                    img.height
                  );
              setCrop(selection);
              setCompleted({
                unit: 'px',
                x: (selection.x * img.width) / 100,
                y: (selection.y * img.height) / 100,
                width: (selection.width * img.width) / 100,
                height: (selection.height * img.height) / 100,
              });
            }}
          />
        </ReactCrop>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={saving} onClick={() => void save(true)}>
            {t('resetCrop')}
          </Button>
          <Button disabled={saving || !completed} onClick={() => void save()}>
            {saving ? t('saving') : t('saveCrop')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
