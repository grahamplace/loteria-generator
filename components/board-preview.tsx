'use client';

import { useEffect, useRef, useState } from 'react';
import { getImageProps } from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { renderBoardToCanvas, type LotteriaCard } from '@/lib/generate-boards';
import { MIN_EXPORT_CARD_COUNT } from '@/lib/constants';
import type { BoardStyleOptions } from '@/lib/themes/presets';
import { cardImageProps, CARD_GRID_THUMB_WIDTH } from '@/lib/card-image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

export function useBoardPreview({ styles, boardName, cards }: BoardPreviewProps) {
  const t = useTranslations('Themes.Builder');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  const searchParams = useSearchParams();
  const pageParam = Number(searchParams.get('previewPage'));
  const requestedPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam - 1 : 0;
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [rendering, setRendering] = useState(true);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const previewImages = useRef(new Map<string, Promise<HTMLImageElement>>());
  const complete = cards
    .filter((card) => !card.isProcessing && !card.error && card.illustration)
    .sort((a, b) => a.number - b.number)
    .map((card) => ({
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
  const isSample = complete.length < MIN_EXPORT_CARD_COUNT;
  const signature = JSON.stringify([pageCards, styles, boardName, locale, isSample]);
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
    renderBoardToCanvas(
      pageCards,
      styles ?? {},
      isSample
        ? [locale === 'es-MX' ? 'Muestra' : 'Sample', styles?.showTitle ? boardName : undefined]
            .filter(Boolean)
            .join(' · ')
        : styles?.showTitle
          ? boardName
          : undefined,
      { scale: 0.25, imageCache: previewImages.current }
    )
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

  return {
    preview,
    previewError,
    rendering,
    retry: () => setPreviewAttempt((n) => n + 1),
    count: complete.length,
    page,
    pageCount,
    firstNumber: pageCards[0]?.number ?? 0,
    lastNumber: pageCards.at(-1)?.number ?? 0,
    goToPage: (index: number) => setPreviewPage(Math.max(0, Math.min(index, pageCount - 1))),
  };
}

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
        className="size-11 touch-manipulation transition-colors"
        aria-label={t('previousPreviewPage')}
        disabled={page === 0}
        onClick={() => goToPage(page - 1)}
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
        className="size-11 touch-manipulation transition-colors"
        aria-label={t('nextPreviewPage')}
        disabled={page === pageCount - 1}
        onClick={() => goToPage(page + 1)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

export function BoardPreviewImage({
  state,
  fitViewport = false,
  showPagination = true,
}: {
  state: ReturnType<typeof useBoardPreview>;
  fitViewport?: boolean;
  showPagination?: boolean;
}) {
  const t = useTranslations('Themes.Builder');
  const { preview, previewError, rendering, retry, count } = state;
  return (
    <>
      <div
        className={cn(
          'relative mx-auto aspect-[17/22] w-full overflow-hidden rounded-sm bg-muted shadow-md',
          fitViewport &&
            (state.pageCount > 1
              ? 'max-w-[min(100%,max(8rem,calc((100dvh-28rem)*17/22)))]'
              : 'max-w-[min(100%,max(8rem,calc((100dvh-24rem)*17/22)))]')
        )}
        aria-busy={rendering}
      >
        {preview && (
          <>
            {/* The image is an in-memory canvas of the actual PDF renderer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              width={2550}
              height={3300}
              alt={t('previewAlt')}
              className="absolute inset-0 h-full w-full object-contain"
            />
          </>
        )}
        {rendering && (
          <div
            className={`absolute inset-x-3 flex justify-center ${preview ? 'bottom-3' : 'inset-y-0 items-center'}`}
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
      </div>
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
    <aside
      aria-label={t('livePreview')}
      className="w-full min-w-0 max-w-sm justify-self-center rounded-xl border border-border bg-muted/30 p-3 lg:sticky lg:top-24"
    >
      <h3 className="mb-3 text-sm font-medium">{t('livePreview')}</h3>
      <BoardPreviewImage state={state} />
    </aside>
  );
}
