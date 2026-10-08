'use client';

import { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Upload, Package, Plus, Loader2 } from 'lucide-react';
import {
  generateLoteriaSetPdf,
  clampBoardCount,
  type BoardStyleOptions,
} from '@/lib/generate-boards';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { useTranslations } from 'next-intl';
import { MIN_EXPORT_CARD_COUNT, DEFAULT_EXPORT_BOARD_COUNT } from '@/lib/constants';
import { partitionBySize, MAX_UPLOAD_DISPLAY } from '@/lib/upload-limits';
import { UPLOAD_IMAGE_ACCEPT } from '@/lib/image-formats';
import {
  CONVERTIBLE_IMAGE_ACCEPT,
  convertForUpload,
  convertibleKind,
  isUploadCandidate,
} from '@/lib/convert-upload-image';
import { BoardCountStepper } from '@/components/board-count-stepper';
import { Button } from '@/components/ui/button';
import type { PhotoMode } from '@/lib/themes/presets';

interface DisplayCard {
  id: string;
  number: number;
  label: string;
  illustration: string;
  riddle?: string | null;
  isProcessing?: boolean;
  error?: string;
}
interface BoardActionBarProps {
  onFilesSelected: (files: File[]) => void;
  cardCount: number;
  maxCards: number;
  processedCount: number;
  processingCount: number;
  isUnlocked: boolean;
  cards: DisplayCard[];
  boardName: string;
  onUnlockRequired: () => void;
  onOpenDefaults: () => void;
  styleOptions?: BoardStyleOptions | null;
  photoMode?: PhotoMode;
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
      processedCount,
      processingCount,
      isUnlocked,
      cards,
      boardName,
      onUnlockRequired,
      onOpenDefaults,
      styleOptions,
      photoMode = 'illustrated',
    },
    ref
  ) {
    const t = useTranslations('BoardEditor.ActionBar');
    const themes = useTranslations('Themes.Builder');
    const inputRef = useRef<HTMLInputElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState('');
    const [boardCount, setBoardCount] = useState(DEFAULT_EXPORT_BOARD_COUNT);
    const [dragActive, setDragActive] = useState(false);
    const isSample = processedCount < MIN_EXPORT_CARD_COUNT;
    useImperativeHandle(ref, () => ({
      triggerFileSelect() {
        if (cardCount < maxCards) inputRef.current?.click();
        else if (!isUnlocked) onUnlockRequired();
      },
    }));

    async function acceptFiles(files: File[], method: 'drop' | 'picker') {
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
    async function exportPdf() {
      if (processedCount < 1 || isExporting) return;
      setIsExporting(true);
      setProgress(t('toasts.startingExport'));
      try {
        const completed = cards.filter((card) => !card.isProcessing && !card.error);
        const count = isSample ? 1 : clampBoardCount(boardCount);
        const blob = await generateLoteriaSetPdf(
          completed,
          styleOptions ?? {},
          setProgress,
          { title: t('callerSheetTitle') },
          count,
          {
            boardTitle: styleOptions?.showTitle ? boardName : undefined,
            sampleLabel: themes('sample'),
            cutInstruction: themes('cutInstruction'),
          }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${
          boardName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || 'loteria'
        }-${isSample ? 'sample' : 'loteria-set'}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        posthog.capture('board_exported', {
          card_count: completed.length,
          board_count: count,
          is_unlocked: isUnlocked,
          theme: styleOptions?.presetId ?? 'classic',
          photo_mode: photoMode,
          sample: isSample,
        });
        toast.success(t('toasts.exportSuccessTitle'), {
          description: t('toasts.exportSuccessDesc', { count }),
        });
      } catch (error) {
        posthog.captureException(error);
        toast.error(t('toasts.exportFailedTitle'));
      } finally {
        setIsExporting(false);
      }
    }
    return (
      <section className="grid gap-3 md:grid-cols-2" aria-label={themes('uploadExport')}>
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
          <p className="mt-1 text-sm text-muted-foreground">
            {processingCount > 0
              ? themes('processing', { count: processingCount })
              : themes(photoMode === 'original' ? 'original' : 'illustrated')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                cardCount >= maxCards && !isUnlocked
                  ? onUnlockRequired()
                  : inputRef.current?.click()
              }
              disabled={cardCount >= maxCards && isUnlocked}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('choosePhotos')}
            </Button>
            <Button variant="outline" onClick={onOpenDefaults}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addClassic')}
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">{isSample ? themes('sampleExport') : t('exportButton')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSample ? themes('sampleExplanation') : themes('fullExport')}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {!isSample && (
              <BoardCountStepper
                value={boardCount}
                onChange={setBoardCount}
                disabled={isExporting}
                label={t('boardCountLabel')}
                decreaseLabel={t('boardCountDecrease')}
                increaseLabel={t('boardCountIncrease')}
                size="sm"
              />
            )}
            <Button onClick={() => void exportPdf()} disabled={processedCount < 1 || isExporting}>
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Package className="mr-2 h-4 w-4" />
              )}
              {isSample ? themes('downloadSample') : t('exportButton')}
            </Button>
          </div>
          {isExporting && (
            <p role="status" className="mt-2 text-sm">
              {progress}
            </p>
          )}
        </div>
      </section>
    );
  }
);
