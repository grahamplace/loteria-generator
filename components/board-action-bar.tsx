'use client';

import { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { ImagePlus, Upload, Plus, Unlock } from 'lucide-react';
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
import { useUnlockPriceDisplay } from '@/hooks/use-unlock-price';
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
  /** Add photos dropped elsewhere on the page, e.g. onto the card grid. */
  dropFiles: (files: File[]) => void;
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
    const unlockPrice = useUnlockPriceDisplay();
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    useImperativeHandle(ref, () => ({
      triggerFileSelect() {
        if (photoModeSaving) return;
        if (cardCount < maxCards) inputRef.current?.click();
        else if (!isUnlocked) onUnlockRequired();
      },
      dropFiles(files) {
        void acceptFiles(files, 'drop');
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
          {/* Drop target and the two ways to add cards share one row on wider screens. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                aria-hidden="true"
                className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex"
              >
                <ImagePlus className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold">{t('dropPhotos')}</h2>
                <p className="text-xs text-muted-foreground">
                  {t('acceptedFormats', { maxSize: MAX_UPLOAD_DISPLAY })}
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              {cardCount >= maxCards && !isUnlocked ? (
                <Button
                  className="min-h-11 flex-1 touch-manipulation transition-colors sm:flex-none"
                  onClick={onUnlockRequired}
                >
                  <Unlock className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('unlockMoreCards', { price: unlockPrice })}
                </Button>
              ) : (
                <Button
                  className="min-h-11 flex-1 touch-manipulation transition-colors sm:flex-none"
                  onClick={() => inputRef.current?.click()}
                  disabled={photoModeSaving || cardCount >= maxCards}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {t('choosePhotos')}
                </Button>
              )}
              <Button
                className="min-h-11 flex-1 touch-manipulation transition-colors sm:flex-none"
                variant="outline"
                onClick={onOpenDefaults}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('addClassic')}
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-start justify-between gap-3 border-t border-dashed border-border pt-2">
            <PhotoModeSwitch
              photoMode={photoMode}
              saving={photoModeSaving}
              onChange={(mode) => void onPhotoModeChange(mode)}
            />
            <span className="flex min-h-11 shrink-0 items-center text-sm text-muted-foreground tabular-nums">
              {cardCount}/{maxCards}
            </span>
          </div>
          {processingCount > 0 && (
            <p role="status" className="mt-1 text-sm text-muted-foreground">
              {themes('processing', { count: processingCount })}
            </p>
          )}
        </div>
      </section>
    );
  }
);
