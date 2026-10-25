'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  BoardPreviewImage,
  BoardPreviewActions,
  BoardPreviewPagination,
  useBoardPreview,
} from '@/components/board-preview';
import {
  BoardDownloadControls,
  useBoardDownload,
  type BoardDownloadProps,
} from '@/components/board-download-controls';
import { BoardPreviewZoom } from '@/components/board-preview-zoom';
import {
  BoardDesignDialog,
  BoardDesignSheetView,
  BoardThemeRow,
  DESIGN_PARAM,
  closeDesignControls,
  isFieldEscape,
  openDesignControls,
} from '@/components/board-design';
import { useBoardDesign, type BoardSettings } from '@/hooks/use-board-design';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export function BoardPreviewPanel({
  onAddPhotos,
  canAddPhotos,
  onUnlock,
  onSaveDesign,
  ...props
}: BoardDownloadProps & {
  onAddPhotos: () => void;
  canAddPhotos: boolean;
  onUnlock: () => void;
  onSaveDesign: (settings: BoardSettings) => Promise<boolean>;
}) {
  const t = useTranslations('Themes.Builder');
  const searchParams = useSearchParams();
  const designOpen = searchParams.get(DESIGN_PARAM) === '1';
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  // One design session for the sidebar, the dialog, and the phone sheet, so
  // every preview shows unsaved edits and downloads use what you see.
  const design = useBoardDesign({ styles: props.styles, onSave: onSaveDesign });
  const shown = { ...props, styles: design.shownStyles };
  // Both surfaces share the renderer, image cache, board count, and in-flight download.
  const preview = useBoardPreview(shown);
  const download = useBoardDownload(shown);
  const sheetOpen = open || (designOpen && !isDesktop);
  const sheetView = designOpen ? 'design' : 'preview';
  const themeRow = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const shownView = useRef(sheetView);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  // The sheet swaps its content in place; move focus with it.
  useEffect(() => {
    const previous = shownView.current;
    shownView.current = sheetView;
    if (!sheetOpen || previous === sheetView) return;
    (sheetView === 'design' ? backButton : themeRow).current?.focus({ preventScroll: true });
  }, [sheetOpen, sheetView]);

  function setSheetOpen(next: boolean) {
    setOpen(next);
    if (!next) closeDesignControls();
  }

  return (
    <>
      <aside
        data-board-preview
        aria-label={t('livePreview')}
        className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] min-w-0 self-start overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-4 shadow-sm lg:block"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="min-w-0 font-display text-lg font-semibold">{t('livePreview')}</h2>
          <BoardPreviewActions state={preview} />
        </div>
        <BoardPreviewImage state={preview} fitViewport="sidebar" />
        <div className="mt-4 border-t border-border pt-4">
          <BoardThemeRow
            ref={changeButton}
            design={design}
            variant="compact"
            onChange={openDesignControls}
          />
        </div>
        <div className="mt-4">
          <BoardDownloadControls
            state={download}
            onUnlock={props.isUnlocked ? undefined : onUnlock}
          />
        </div>
      </aside>

      <BoardDesignDialog
        open={designOpen && isDesktop}
        onOpenChange={(next) => {
          if (!next) closeDesignControls();
        }}
        design={design}
        preview={preview}
        boardName={props.boardName}
        returnFocusRef={changeButton}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-md backdrop-blur-sm lg:hidden">
          <div className="mx-auto flex max-w-lg gap-2">
            <Button
              variant="outline"
              onClick={onAddPhotos}
              disabled={!canAddPhotos}
              className="min-h-11 touch-manipulation transition-colors"
            >
              <Upload aria-hidden="true" />
              {t('addPhotos')}
            </Button>
            <SheetTrigger asChild>
              <Button
                data-board-preview-open
                className="min-h-11 min-w-0 flex-1 touch-manipulation whitespace-normal transition-colors"
              >
                <Eye aria-hidden="true" />
                {t('previewAndDownload')}
              </Button>
            </SheetTrigger>
          </div>
        </div>
        <SheetContent
          data-board-preview
          side="bottom"
          aria-describedby={undefined}
          closeLabel={t('closePreview')}
          className={cn(
            'max-h-[92dvh] gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)] motion-reduce:animate-none',
            sheetView === 'design' && 'h-[92dvh]'
          )}
          onOpenAutoFocus={(event) => {
            if (sheetView !== 'design') return;
            event.preventDefault();
            backButton.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            // Let inline zoom and color fields handle Escape before dismissing the sheet.
            if (
              isFieldEscape(event) ||
              (preview.inlineZoom > 100 &&
                event.target instanceof Element &&
                event.target.closest('[data-board-inline-zoom]'))
            )
              event.preventDefault();
          }}
        >
          {sheetView === 'design' ? (
            <BoardDesignSheetView
              design={design}
              preview={preview}
              boardName={props.boardName}
              onBack={() => {
                // A deep link opens the sheet straight into this view; keep it open.
                setOpen(true);
                closeDesignControls();
              }}
              backRef={backButton}
            />
          ) : (
            <>
              <SheetHeader className="shrink-0 flex-row items-center justify-between gap-2 pr-16">
                <SheetTitle className="min-w-0">{t('livePreview')}</SheetTitle>
                <BoardPreviewActions state={preview} />
              </SheetHeader>
              <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
                <div className="mx-auto max-w-sm">
                  <BoardPreviewImage state={preview} showPagination={false} />
                </div>
              </div>
              <div className="shrink-0 bg-background px-4 pb-4">
                <div className="mx-auto max-w-sm space-y-3">
                  <BoardPreviewPagination state={preview} />
                  <BoardThemeRow
                    ref={themeRow}
                    design={design}
                    variant="row"
                    onChange={openDesignControls}
                  />
                  <BoardDownloadControls
                    state={download}
                    onUnlock={props.isUnlocked ? undefined : onUnlock}
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <BoardPreviewZoom state={preview} pagination={<BoardPreviewPagination state={preview} />} />
    </>
  );
}
