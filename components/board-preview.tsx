'use client';

import { useEffect, useRef, useState } from 'react';
import { getImageProps } from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Loader2, Maximize2, X, ZoomIn } from 'lucide-react';
import { renderBoardToCanvas, type LotteriaCard } from '@/lib/generate-boards';
import { MIN_EXPORT_CARD_COUNT } from '@/lib/constants';
import type { BoardStyleOptions } from '@/lib/themes/presets';
import { cardImageProps, CARD_GRID_THUMB_WIDTH, CARD_DETAIL_THUMB_WIDTH } from '@/lib/card-image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BoardPreviewZoom } from '@/components/board-preview-zoom';
import { BoardPreviewInlineZoom } from '@/components/board-preview-inline-zoom';

export interface BoardPreviewProps {
  styles?: BoardStyleOptions | null;
  boardName: string;
  cards: LotteriaCard[];
}

function setPreviewPage(page: number, replace = false) {
  const url = new URL(window.location.href);
  if (page === 0) url.searchParams.delete('previewPage');
  else url.searchParams.set('previewPage', String(page + 1));
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}

export const previewZoomLevels = [100, 150, 200, 300, 400] as const;

function setPreviewZoom(zoom: number | null, replace = false) {
  const url = new URL(window.location.href);
  if (zoom === null) url.searchParams.delete('previewZoom');
  else url.searchParams.set('previewZoom', String(zoom));
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}

export function useBoardPreview({ styles, boardName, cards }: BoardPreviewProps) {
  const t = useTranslations('Themes.Builder');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  const searchParams = useSearchParams();
  const pageParam = Number(searchParams.get('previewPage'));
  const expanded = searchParams.get('previewZoom') != null;
  const zoomParam = Number(searchParams.get('previewZoom'));
  const zoom = previewZoomLevels.find((value) => value === zoomParam) ?? 100;
  const inlineZoomParam = Number(searchParams.get('previewScale'));
  const inlineZoom = inlineZoomParam > 100 ? 200 : 100;
  const needsDetail = expanded || inlineZoom > 100;
  const expandTrigger = useRef<HTMLElement | null>(null);
  const detailImages = useRef(new Map<string, Promise<HTMLImageElement>>());
  // Detailed renders by page signature: in-flight or finished, so paging never renders twice.
  const detailRenders = useRef(new Map<string, { promise: Promise<string>; src?: string }>());
  const [detailSources, setDetailSources] = useState<ReadonlyMap<string, string>>(new Map());
  const [detailRendering, setDetailRendering] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailAttempt, setDetailAttempt] = useState(0);
  const requestedPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam - 1 : 0;
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [rendering, setRendering] = useState(true);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const previewImages = useRef(new Map<string, Promise<HTMLImageElement>>());
  const readyCards = cards
    .filter((card) => !card.isProcessing && !card.error && card.illustration)
    .sort((a, b) => a.number - b.number);
  const complete = readyCards.map((card) => ({
    ...card,
    illustration: getImageProps({
      ...cardImageProps(card.illustration, CARD_GRID_THUMB_WIDTH),
      width: 160,
      height: 240,
      alt: '',
    }).props.src,
  }));
  const pageCount = Math.max(1, Math.ceil(complete.length / MIN_EXPORT_CARD_COUNT));
  const page = Math.min(requestedPage, pageCount - 1);
  const pageCards = complete.slice(
    page * MIN_EXPORT_CARD_COUNT,
    (page + 1) * MIN_EXPORT_CARD_COUNT
  );
  const pageSignatures = Array.from({ length: pageCount }, (_, index) =>
    JSON.stringify([
      complete.slice(index * MIN_EXPORT_CARD_COUNT, (index + 1) * MIN_EXPORT_CARD_COUNT),
      styles,
      boardName,
      locale,
    ])
  );
  const signature = pageSignatures[page];
  const allSignatures = JSON.stringify(pageSignatures);
  const imageSources = JSON.stringify(complete.map((card) => card.illustration));

  // Removing cards can remove the current page. Keep the URL on a valid page.
  useEffect(() => {
    if (requestedPage !== page) setPreviewPage(page, true);
  }, [requestedPage, page]);

  useEffect(() => {
    const activeImages = new Set<string>(JSON.parse(imageSources));
    for (const src of previewImages.current.keys()) {
      if (!activeImages.has(src)) previewImages.current.delete(src);
    }
  }, [imageSources]);

  useEffect(() => {
    let cancelled = false;
    setRendering(true);
    setPreviewError('');
    renderBoardToCanvas(pageCards, styles ?? {}, styles?.showTitle ? boardName : undefined, {
      scale: 0.25,
      imageCache: previewImages.current,
    })
      .then((canvas) => {
        if (!cancelled) setPreview(canvas.toDataURL('image/jpeg', 0.7));
      })
      .catch(() => {
        if (!cancelled) setPreviewError(t('previewError'));
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
    // Render only when the serialized print inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, previewAttempt]);

  useEffect(() => {
    if (!needsDetail) {
      detailImages.current.clear();
      return;
    }
    setDetailError('');
    const signatures: string[] = JSON.parse(allSignatures);
    const renders = detailRenders.current;
    const activeSignatures = new Set(signatures);
    for (const key of renders.keys()) {
      if (!activeSignatures.has(key)) renders.delete(key);
    }
    setDetailSources((current) =>
      [...current.keys()].every((key) => activeSignatures.has(key))
        ? current
        : new Map([...current].filter(([key]) => activeSignatures.has(key)))
    );
    // Inline zoom, full-screen expansion, and every page share one set of detailed renders.
    const detailCards = readyCards.map((card) => ({
      ...card,
      illustration: getImageProps({
        ...cardImageProps(card.illustration, CARD_DETAIL_THUMB_WIDTH),
        width: 400,
        height: 600,
        alt: '',
      }).props.src,
    }));
    const activeImages = new Set(detailCards.map((card) => card.illustration));
    for (const src of detailImages.current.keys()) {
      if (!activeImages.has(src)) detailImages.current.delete(src);
    }
    function renderPage(index: number) {
      const key = signatures[index];
      const existing = renders.get(key);
      if (existing) return existing.promise;
      const entry: { promise: Promise<string>; src?: string } = {
        promise: renderBoardToCanvas(
          detailCards.slice(index * MIN_EXPORT_CARD_COUNT, (index + 1) * MIN_EXPORT_CARD_COUNT),
          styles ?? {},
          styles?.showTitle ? boardName : undefined,
          { scale: 1, imageCache: detailImages.current }
        ).then((canvas) => {
          const src = canvas.toDataURL('image/png');
          entry.src = src;
          // A finished render stays valid for its signature even if the user moved on.
          if (renders.get(key) === entry) {
            setDetailSources((current) => new Map(current).set(key, src));
          }
          return src;
        }),
      };
      entry.promise.catch(() => {
        if (renders.get(key) === entry) renders.delete(key);
      });
      renders.set(key, entry);
      return entry.promise;
    }

    let cancelled = false;
    setDetailRendering(!renders.get(signature)?.src);
    renderPage(page)
      .then(async () => {
        if (cancelled) return;
        setDetailRendering(false);
        // Warm the other pages, nearest first, so paging shows full detail immediately.
        const others = signatures
          .map((_, index) => index)
          .filter((index) => index !== page)
          .sort((a, b) => Math.abs(a - page) - Math.abs(b - page));
        for (const index of others) {
          if (cancelled) return;
          // A failed warm-up retries on demand when the user opens that page.
          await renderPage(index).catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetailError(t('previewError'));
          setDetailRendering(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // Zoom uses the same full-resolution renders; only print inputs trigger new work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsDetail, allSignatures, page, detailAttempt]);

  return {
    preview,
    previewError,
    rendering,
    expanded,
    zoom,
    inlineZoom,
    setInlineZoom: (value: 100 | 200) => {
      const url = new URL(window.location.href);
      if (value === 100) url.searchParams.delete('previewScale');
      else url.searchParams.set('previewScale', String(value));
      window.history.pushState(null, '', url);
    },
    zoomLevels: previewZoomLevels,
    detailPreview: detailSources.get(signature) ?? null,
    detailRendering,
    detailError,
    retryDetail: () => setDetailAttempt((n) => n + 1),
    setZoom: (value: number) => setPreviewZoom(value, true),
    expand: () => {
      expandTrigger.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPreviewZoom(100);
    },
    closeExpanded: () => setPreviewZoom(null, true),
    restoreExpandFocus: () => {
      const previous = expandTrigger.current;
      const target =
        previous?.isConnected && previous.getClientRects().length
          ? previous
          : Array.from(
              document.querySelectorAll<HTMLElement>(
                '[data-board-preview-expand], [data-board-preview-open]'
              )
            ).find((element) => element.getClientRects().length);
      target?.focus({ preventScroll: true });
    },
    retry: () => setPreviewAttempt((n) => n + 1),
    count: complete.length,
    page,
    pageCount,
    firstNumber: pageCards[0]?.number ?? 0,
    lastNumber: pageCards.at(-1)?.number ?? 0,
    goToPage: (index: number) => setPreviewPage(Math.max(0, Math.min(index, pageCount - 1))),
  };
}

// aria-disabled, not disabled: a disabled button drops focus when the last page
// is reached, and the focus trap's scripted refocus then shows a keyboard ring.
const pageButtonClass =
  'size-11 touch-manipulation transition-colors aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-background aria-disabled:hover:text-foreground';

export function BoardPreviewPagination({ state }: { state: ReturnType<typeof useBoardPreview> }) {
  const t = useTranslations('Themes.Builder');
  const { page, pageCount, firstNumber, lastNumber, goToPage } = state;
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={t('previewPages')} className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={pageButtonClass}
        aria-label={t('previousPreviewPage')}
        aria-disabled={page === 0}
        onClick={() => page > 0 && goToPage(page - 1)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <div role="status" className="min-w-0 flex-1 text-center tabular-nums">
        <p className="text-sm font-medium">
          {t('previewPage', { current: page + 1, total: pageCount })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('previewCardRange', { first: firstNumber, last: lastNumber })}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={pageButtonClass}
        aria-label={t('nextPreviewPage')}
        aria-disabled={page === pageCount - 1}
        onClick={() => page < pageCount - 1 && goToPage(page + 1)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

export function BoardPreviewActions({ state }: { state: ReturnType<typeof useBoardPreview> }) {
  const t = useTranslations('Themes.Builder');
  const zoomed = state.inlineZoom > 100;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={state.expand}
        disabled={!state.preview || !!state.previewError}
        data-board-preview-expand
        aria-label={t('expandPreview')}
        className="inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50"
      >
        <Maximize2 className="size-4" aria-hidden="true" />
        <span className="hidden min-[380px]:inline">{t('expand')}</span>
      </button>
      <button
        type="button"
        aria-label={t(zoomed ? 'zoomOut' : 'zoomIn')}
        title={t(zoomed ? 'zoomOut' : 'zoomIn')}
        disabled={!zoomed && (!state.preview || !!state.previewError)}
        data-board-inline-zoom
        className="inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50"
        onClick={(event) => {
          if (zoomed) {
            // Focus the image on this surface, not its hidden desktop/mobile counterpart.
            event.currentTarget
              .closest('[data-board-preview]')
              ?.querySelector<HTMLButtonElement>('[data-board-preview-image]')
              ?.focus({ preventScroll: true });
          }
          state.setInlineZoom(zoomed ? 100 : 200);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && zoomed) {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.click();
          }
        }}
      >
        {zoomed ? (
          <X className="size-4" aria-hidden="true" />
        ) : (
          <ZoomIn className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function BoardPreviewImage({
  state,
  fitViewport = false,
  showPagination = true,
}: {
  state: ReturnType<typeof useBoardPreview>;
  /**
   * Shrink the board so its surroundings fit on screen. `sidebar` leaves room
   * for the Theme row and download controls below it.
   */
  fitViewport?: boolean | 'sidebar';
  showPagination?: boolean;
}) {
  const t = useTranslations('Themes.Builder');
  const { preview, previewError, rendering, retry, count } = state;
  const inspecting = state.inlineZoom > 100;
  const busy = rendering || (inspecting && state.detailRendering);
  return (
    <>
      <BoardPreviewInlineZoom
        state={state}
        viewportClassName={cn(
          fitViewport === 'sidebar'
            ? state.pageCount > 1
              ? // The narrower sidebar below xl wraps its text onto extra lines.
                'max-w-[min(100%,max(8rem,calc((100dvh-36.5rem)*17/22)))] xl:max-w-[min(100%,max(8rem,calc((100dvh-34.25rem)*17/22)))]'
              : 'max-w-[min(100%,max(8rem,calc((100dvh-32.5rem)*17/22)))] xl:max-w-[min(100%,max(8rem,calc((100dvh-30.25rem)*17/22)))]'
            : fitViewport &&
                (state.pageCount > 1
                  ? 'max-w-[min(100%,max(8rem,calc((100dvh-29rem)*17/22)))]'
                  : 'max-w-[min(100%,max(8rem,calc((100dvh-25rem)*17/22)))]')
        )}
      >
        {busy && (
          <div
            className={`pointer-events-none absolute inset-x-3 z-20 flex justify-center ${preview ? 'bottom-3' : 'inset-y-0 items-center'}`}
          >
            <span
              role="status"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 text-sm shadow-sm"
            >
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {t('rendering')}
            </span>
          </div>
        )}
        {previewError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 p-5 text-center">
            <p role="alert" className="text-sm">
              {previewError}
            </p>
            <Button type="button" variant="outline" onClick={retry}>
              {t('retryPreview')}
            </Button>
          </div>
        )}
      </BoardPreviewInlineZoom>
      {showPagination && state.pageCount > 1 && (
        <div className="mt-3">
          <BoardPreviewPagination state={state} />
        </div>
      )}
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {t(
          count === 0
            ? 'emptyPreview'
            : count < MIN_EXPORT_CARD_COUNT
              ? 'partialPreview'
              : 'fullPreview'
        )}
      </p>
    </>
  );
}

export function BoardPreview(props: BoardPreviewProps) {
  const t = useTranslations('Themes.Builder');
  const state = useBoardPreview(props);
  return (
    <>
      <aside
        data-board-preview
        aria-label={t('livePreview')}
        className="w-full min-w-0 max-w-sm justify-self-center rounded-xl border border-border bg-muted/30 p-3 lg:sticky lg:top-24"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="min-w-0 text-sm font-medium">{t('livePreview')}</h3>
          <BoardPreviewActions state={state} />
        </div>
        <BoardPreviewImage state={state} />
      </aside>
      <BoardPreviewZoom state={state} pagination={<BoardPreviewPagination state={state} />} />
    </>
  );
}
