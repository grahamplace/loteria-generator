'use client';

import { useEffect, useRef, useState } from 'react';
import { getImageProps } from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { renderBoardToCanvas, type LotteriaCard } from '@/lib/generate-boards';
import type { BoardStyleOptions } from '@/lib/themes/presets';
import { cardImageProps, CARD_GRID_THUMB_WIDTH } from '@/lib/card-image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BoardPreviewProps {
  styles?: BoardStyleOptions | null;
  boardName: string;
  cards: LotteriaCard[];
}

export function useBoardPreview({ styles, boardName, cards }: BoardPreviewProps) {
  const t = useTranslations('Themes.Builder');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [rendering, setRendering] = useState(true);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const previewImages = useRef(new Map<string, Promise<HTMLImageElement>>());
  const complete = cards
    .filter((card) => !card.isProcessing && !card.error && card.illustration)
    .slice(0, 16)
    .map((card) => ({
      ...card,
      illustration: getImageProps({
        ...cardImageProps(card.illustration, CARD_GRID_THUMB_WIDTH),
        width: 160,
        height: 240,
        alt: '',
      }).props.src,
    }));
  const signature = JSON.stringify([complete, styles, boardName, locale]);

  useEffect(() => {
    let cancelled = false;
    setRendering(true);
    setPreviewError('');
    const activeImages = new Set(complete.map((card) => card.illustration));
    for (const src of previewImages.current.keys()) {
      if (!activeImages.has(src)) previewImages.current.delete(src);
    }
    renderBoardToCanvas(
      complete,
      styles ?? {},
      complete.length < 16
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
  };
}

export function BoardPreviewImage({
  state,
  fitViewport = false,
}: {
  state: ReturnType<typeof useBoardPreview>;
  fitViewport?: boolean;
}) {
  const t = useTranslations('Themes.Builder');
  const { preview, previewError, rendering, retry, count } = state;
  return (
    <>
      <div
        className={cn(
          'relative mx-auto aspect-[17/22] w-full overflow-hidden rounded-sm bg-muted shadow-md',
          fitViewport && 'max-w-[min(100%,max(8rem,calc((100dvh-24rem)*17/22)))]'
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
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {t(count === 0 ? 'emptyPreview' : count < 16 ? 'partialPreview' : 'fullPreview')}
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
