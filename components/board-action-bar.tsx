'use client';

import { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Upload, Plus } from 'lucide-react';
import type { BoardStyleOptions } from '@/lib/themes/presets';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { useTranslations } from 'next-intl';
import { partitionBySize, MAX_UPLOAD_DISPLAY } from '@/lib/upload-limits';
import { UPLOAD_IMAGE_ACCEPT } from '@/lib/image-formats';
import {
  CONVERTIBLE_IMAGE_ACCEPT,
  convertForUpload,
  convertibleKind,
  isUploadCandidate,
} from '@/lib/convert-upload-image';
import { Button } from '@/components/ui/button';
import { PhotoModeSwitch } from '@/components/photo-mode-switch';
import type { PhotoMode } from '@/lib/themes/presets';

interface BoardActionBarProps {
  onFilesSelected: (files: File[]) => void;
  cardCount: number;
  maxCards: number;
  processingCount: number;
  isUnlocked: boolean;
  onUnlockRequired: () => void;
  onOpenDefaults: () => void;
  styleOptions?: BoardStyleOptions | null;
  photoMode?: PhotoMode;
  photoModeSaving: boolean;
  onPhotoModeChange: (mode: PhotoMode) => Promise<boolean>;
}
export interface BoardActionBarRef {
  triggerFileSelect: () => void;
}

export const BoardActionBar = forwardRef<BoardActionBarRef, BoardActionBarProps>(
  function BoardActionBar(
    {
      onFilesSelected,
      cardCount,
      maxCards,
      processingCount,
      isUnlocked,
      onUnlockRequired,
      onOpenDefaults,
      styleOptions,
      photoMode = 'illustrated',
      photoModeSaving,
      onPhotoModeChange,
    },
    ref
  ) {
    const t = useTranslations('BoardEditor.ActionBar');
    const themes = useTranslations('Themes.Builder');
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    useImperativeHandle(ref, () => ({
      triggerFileSelect() {
        if (photoModeSaving) return;
        if (cardCount < maxCards) inputRef.current?.click();
        else if (!isUnlocked) onUnlockRequired();
      },
    }));

    async function acceptFiles(files: File[], method: 'drop' | 'picker') {
      if (photoModeSaving) return;
      const candidates = files.filter(isUploadCandidate);
      const toConvert = candidates.filter((f) => convertibleKind(f)).length;
      const convertingToast =
        toConvert > 0
          ? toast.loading(t('toasts.convertingPhotos', { count: toConvert }))
          : undefined;
      const imageFiles: File[] = [];
      let unreadable = 0;
      for (const file of candidates) {
        try {
          imageFiles.push(await convertForUpload(file));
        } catch (err) {
          console.warn('Photo conversion failed', { name: file.name, type: file.type, err });
          unreadable++;
        }
      }
      if (convertingToast !== undefined) toast.dismiss(convertingToast);
      if (unreadable > 0) {
        toast.error(t('toasts.convertFailedTitle'), {
          description: t('toasts.convertFailedDesc', { count: unreadable }),
        });
      }
      const { valid, oversized } = partitionBySize(imageFiles);
      if (oversized.length)
        toast.error(t('toasts.tooLargeTitle'), {
          description: t('toasts.tooLargeDesc', {
            count: oversized.length,
            maxSize: MAX_UPLOAD_DISPLAY,
          }),
        });
      if (valid.length > maxCards - cardCount && !isUnlocked) onUnlockRequired();
      const accepted = valid.slice(0, Math.max(0, maxCards - cardCount));
      if (accepted.length) {
        posthog.capture('photos_uploaded', {
          count: accepted.length,
          method,
          theme: styleOptions?.presetId ?? 'classic',
          photo_mode: photoMode,
        });
        onFilesSelected(accepted);
      }
    }
    return (
      <section aria-label={t('dropPhotos')}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={`${UPLOAD_IMAGE_ACCEPT},${CONVERTIBLE_IMAGE_ACCEPT}`}
          className="hidden"
          onChange={(event) => {
            void acceptFiles(Array.from(event.target.files ?? []), 'picker');
            event.target.value = '';
          }}
        />
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            void acceptFiles(Array.from(event.dataTransfer.files), 'drop');
          }}
          className={`rounded-xl border-2 border-dashed p-4 ${dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{t('dropPhotos')}</h2>
            <span className="text-sm tabular-nums">
              {cardCount}/{maxCards}
            </span>
          </div>
          <div className="mt-1">
            <PhotoModeSwitch
              photoMode={photoMode}
              saving={photoModeSaving}
              onChange={(mode) => void onPhotoModeChange(mode)}
            />
          </div>
          {processingCount > 0 && (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              {themes('processing', { count: processingCount })}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="min-h-11 touch-manipulation transition-colors"
              onClick={() =>
                cardCount >= maxCards && !isUnlocked
                  ? onUnlockRequired()
                  : inputRef.current?.click()
              }
              disabled={photoModeSaving || (cardCount >= maxCards && isUnlocked)}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('choosePhotos')}
            </Button>
            <Button
              className="min-h-11 touch-manipulation transition-colors"
              variant="outline"
              onClick={onOpenDefaults}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('addClassic')}
            </Button>
          </div>
        </div>
      </section>
    );
  }
);
