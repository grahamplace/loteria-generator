'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, Loader2, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { generateLoteriaSetPdf, clampBoardCount } from '@/lib/generate-boards';
import { MIN_EXPORT_CARD_COUNT, DEFAULT_EXPORT_BOARD_COUNT } from '@/lib/constants';
import type { PhotoMode } from '@/lib/themes/presets';
import type { BoardPreviewProps } from '@/components/board-preview';
import { BoardCountStepper } from '@/components/board-count-stepper';
import { Button } from '@/components/ui/button';

export interface BoardDownloadProps extends BoardPreviewProps {
  photoMode: PhotoMode;
  isUnlocked: boolean;
}

export function useBoardDownload({
  cards,
  styles: styleOptions,
  boardName,
  photoMode,
  isUnlocked,
}: BoardDownloadProps) {
  const t = useTranslations('BoardEditor.ActionBar');
  const themes = useTranslations('Themes.Builder');
  const locale = useLocale();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [boardCount, setBoardCount] = useState(DEFAULT_EXPORT_BOARD_COUNT);
  const completed = cards.filter((card) => !card.isProcessing && !card.error && card.illustration);
  const isSample = completed.length < MIN_EXPORT_CARD_COUNT;
  async function exportPdf() {
    if (completed.length < 1 || isExporting) return;
    setIsExporting(true);
    setProgress(t('toasts.startingExport'));
    try {
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
        locale,
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

  return {
    exportPdf,
    isExporting,
    progress,
    boardCount,
    setBoardCount,
    isSample,
    canExport: completed.length > 0,
  };
}

export function BoardDownloadControls({
  state,
  onUnlock,
}: {
  state: ReturnType<typeof useBoardDownload>;
  onUnlock?: () => void;
}) {
  const t = useTranslations('BoardEditor.ActionBar');
  const themes = useTranslations('Themes.Builder');
  const unlock = useTranslations('BoardEditor.UnlockPrompt');
  const { exportPdf, isExporting, progress, boardCount, setBoardCount, isSample, canExport } =
    state;
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {!isSample && (
        <div className="flex flex-wrap items-center justify-between gap-2 max-lg:[&_button]:min-h-11 max-lg:[&_button]:min-w-11 max-lg:[&_input]:min-h-11 max-lg:[&_input]:text-base">
          <span className="text-sm font-medium">{t('boardCountLabel')}</span>
          <BoardCountStepper
            value={boardCount}
            onChange={setBoardCount}
            disabled={isExporting}
            label={t('boardCountLabel')}
            decreaseLabel={t('boardCountDecrease')}
            increaseLabel={t('boardCountIncrease')}
            size="sm"
          />
        </div>
      )}
      <Button
        className="min-h-11 w-full touch-manipulation transition-colors"
        onClick={() => void exportPdf()}
        disabled={!canExport || isExporting}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        {themes(isSample ? 'downloadPreview' : 'downloadSet')}
      </Button>
      {onUnlock && (
        <Button
          variant="outline"
          className="min-h-11 w-full touch-manipulation border-primary/30 text-primary transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
          onClick={onUnlock}
        >
          <Unlock className="h-4 w-4" aria-hidden="true" />
          {unlock('unlockButton')}
        </Button>
      )}
      {isExporting && (
        <p role="status" className="text-sm">
          {progress}
        </p>
      )}
    </div>
  );
}
