'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Loader2, Minus, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { useBoardPreview } from '@/components/board-preview';

export function BoardPreviewZoom({
  state,
  pagination,
}: {
  state: ReturnType<typeof useBoardPreview>;
  pagination: ReactNode;
}) {
  const t = useTranslations('Themes.Builder');
  const format = useFormatter();
  const viewport = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const zoomIndex = state.zoomLevels.indexOf(state.zoom);
  const source = state.detailPreview ?? state.preview;

  function zoomTo(value: number) {
    const element = viewport.current;
    if (element) {
      anchor.current = {
        x: (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth,
        y: (element.scrollTop + element.clientHeight / 2) / element.scrollHeight,
      };
    }
    state.setZoom(value);
  }

  // Keep the inspected part of the board centered as the CSS-sized page grows.
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !anchor.current) return;
    const { x, y } = anchor.current;
    const { scrollWidth, scrollHeight, clientWidth, clientHeight } = element;
    element.scrollLeft = x * scrollWidth - clientWidth / 2;
    element.scrollTop = y * scrollHeight - clientHeight / 2;
    anchor.current = null;
  }, [state.zoom]);

  useLayoutEffect(() => {
    if (viewport.current) {
      viewport.current.scrollLeft = 0;
      viewport.current.scrollTop = 0;
    }
  }, [state.page]);

  return (
    <Dialog
      open={state.expanded}
      onOpenChange={(open) => {
        if (!open) state.closeExpanded();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="left-0 top-0 z-[60] grid h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-0 p-0 data-[state=open]:animate-none data-[state=closed]:animate-none sm:max-w-none"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeButton.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          state.restoreExpandFocus();
        }}
      >
        <header className="flex min-w-0 items-center gap-2 border-b border-border bg-background pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <DialogTitle className="sr-only min-w-0 truncate font-display sm:not-sr-only sm:mr-auto">
            {t('expandedPreview')}
          </DialogTitle>
          <div
            role="group"
            aria-label={t('previewZoom')}
            className="mr-auto flex items-center gap-1 sm:mr-4"
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 touch-manipulation transition-colors"
              aria-label={t('zoomOut')}
              disabled={zoomIndex === 0}
              onClick={() => zoomTo(state.zoomLevels[zoomIndex - 1])}
            >
              <Minus aria-hidden="true" />
            </Button>
            <span role="status" className="min-w-12 text-center text-sm tabular-nums">
              {format.number(state.zoom / 100, { style: 'percent' })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 touch-manipulation transition-colors"
              aria-label={t('zoomIn')}
              disabled={zoomIndex === state.zoomLevels.length - 1}
              onClick={() => zoomTo(state.zoomLevels[zoomIndex + 1])}
            >
              <Plus aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 touch-manipulation px-3 transition-colors"
              aria-label={t('fitPreviewLabel')}
              disabled={zoomIndex === 0}
              onClick={() => zoomTo(100)}
            >
              {t('fitPreview')}
            </Button>
          </div>
          <Button
            ref={closeButton}
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 touch-manipulation transition-colors"
            aria-label={t('closeExpandedPreview')}
            onClick={state.closeExpanded}
          >
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="relative min-h-0 min-w-0">
          <div
            ref={viewport}
            role="region"
            aria-label={t('panPreview')}
            aria-busy={state.detailRendering}
            tabIndex={0}
            className="h-full w-full overflow-auto overscroll-contain bg-muted/40 [container-type:size] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            <div className="grid min-h-full min-w-full w-fit place-items-center p-4">
              <div
                className="relative aspect-[17/22] shrink-0 bg-muted shadow-lg"
                style={{
                  width: `calc(min(calc(100cqw - 2rem), calc((100cqh - 2rem) * 17 / 22)) * ${state.zoom / 100})`,
                }}
              >
                {source && (
                  // This canvas image already has the exact print dimensions and styling.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={source}
                    width={2550}
                    height={3300}
                    alt={t('previewAlt')}
                    draggable={false}
                    className="absolute inset-0 h-full w-full max-w-none select-none"
                  />
                )}
              </div>
            </div>
          </div>
          {state.detailRendering && (
            <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-center">
              <span
                role="status"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 text-sm shadow-sm"
              >
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {t('rendering')}
              </span>
            </div>
          )}
          {state.detailError && (
            <div className="absolute inset-x-4 top-4 mx-auto flex max-w-lg flex-wrap items-center justify-center gap-3 rounded-lg border border-border bg-background/95 p-3 shadow-sm">
              <p role="alert" className="text-sm">
                {state.detailError}
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 touch-manipulation transition-colors"
                onClick={state.retryDetail}
              >
                {t('retryPreview')}
              </Button>
            </div>
          )}
        </div>
        <footer className="bg-background pb-[env(safe-area-inset-bottom)]">
          {state.pageCount > 1 && (
            <div className="border-t border-border pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] py-2">
              <div className="mx-auto max-w-sm">{pagination}</div>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
