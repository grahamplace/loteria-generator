'use client';

import { useId, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Upload, Plus, Check, ImageIcon, Sparkles, Loader2 } from 'lucide-react';
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
    const photoModeName = useId();
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
          <fieldset
            disabled={photoModeSaving}
            aria-busy={photoModeSaving}
            className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          >
            <legend className="sr-only">{themes('photoMode')}</legend>
            {(['illustrated', 'original'] as const).map((mode) => {
              const Icon = mode === 'illustrated' ? Sparkles : ImageIcon;
              const selected = photoMode === mode;
              return (
                <label key={mode} className="relative min-w-0 cursor-pointer">
                  <input
                    type="radio"
                    name={photoModeName}
                    value={mode}
                    checked={selected}
                    onChange={() => void onPhotoModeChange(mode)}
                    className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-wait"
                  />
                  <span className="flex h-full min-h-11 touch-manipulation items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors peer-hover:border-primary/50 peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-60">
                    {selected && photoModeSaving ? (
                      <Loader2
                        className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : selected ? (
                      <Check className="size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{themes(mode)}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
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
