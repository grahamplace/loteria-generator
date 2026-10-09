'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import type { useBoardPreview } from '@/components/board-preview';
import { cn } from '@/lib/utils';

type Point = { x: number; y: number };

export function BoardPreviewInlineZoom({
  state,
  viewportClassName,
  children,
}: {
  state: ReturnType<typeof useBoardPreview>;
  viewportClassName?: string;
  children: ReactNode;
}) {
  const t = useTranslations('Themes.Builder');
  const viewport = useRef<HTMLDivElement>(null);
  const imageButton = useRef<HTMLButtonElement>(null);
  const anchor = useRef<Point | null>(null);
  const restoreFocus = useRef(false);
  const drag = useRef<{ start: Point; scroll: Point; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const zoomed = state.inlineZoom > 100;
  const source = (zoomed ? state.detailPreview : null) ?? state.preview;

  function zoomTo(value: 100 | 200, point?: Point) {
    const element = viewport.current;
    if (element) {
      anchor.current = {
        x: (element.scrollLeft + (point?.x ?? element.clientWidth / 2)) / element.scrollWidth,
        y: (element.scrollTop + (point?.y ?? element.clientHeight / 2)) / element.scrollHeight,
      };
    }
    restoreFocus.current = value === 100;
    state.setInlineZoom(value);
  }

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (state.inlineZoom === 100) {
      element.scrollLeft = 0;
      element.scrollTop = 0;
    } else if (anchor.current) {
      const { scrollWidth, scrollHeight, clientWidth, clientHeight } = element;
      element.scrollLeft = anchor.current.x * scrollWidth - clientWidth / 2;
      element.scrollTop = anchor.current.y * scrollHeight - clientHeight / 2;
    }
    anchor.current = null;
    if (restoreFocus.current) {
      imageButton.current?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [state.inlineZoom]);

  // Keep the inspected location across design edits; only a new card page resets it.
  useLayoutEffect(() => {
    if (viewport.current) {
      viewport.current.scrollLeft = 0;
      viewport.current.scrollTop = 0;
    }
  }, [state.page]);

  function clickPreview(event: MouseEvent<HTMLButtonElement>) {
    if (suppressClick.current && event.detail > 0) {
      suppressClick.current = false;
      return;
    }
    const bounds = viewport.current?.getBoundingClientRect();
    const point =
      bounds && event.detail > 0
        ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
        : undefined;
    zoomTo(zoomed ? 100 : 200, point);
  }

  function startPan(event: PointerEvent<HTMLButtonElement>) {
    suppressClick.current = false;
    if (!zoomed || event.pointerType !== 'mouse' || event.button !== 0 || !viewport.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      start: { x: event.clientX, y: event.clientY },
      scroll: { x: viewport.current.scrollLeft, y: viewport.current.scrollTop },
      moved: false,
    };
  }

  function movePan(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || !viewport.current) return;
    const dx = event.clientX - drag.current.start.x;
    const dy = event.clientY - drag.current.start.y;
    if (!drag.current.moved && Math.hypot(dx, dy) < 4) return;
    drag.current.moved = true;
    suppressClick.current = true;
    if (!dragging) setDragging(true);
    viewport.current.scrollLeft = drag.current.scroll.x - dx;
    viewport.current.scrollTop = drag.current.scroll.y - dy;
  }

  function endPan() {
    drag.current = null;
    setDragging(false);
  }

  const controlClassName =
    'inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-md px-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40';

  return (
    <>
      {zoomed && state.detailError && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <p role="alert" className="min-w-0 flex-1">
            {state.detailError}
          </p>
          <button
            type="button"
            className={cn(controlClassName, 'text-primary underline')}
            onClick={state.retryDetail}
          >
            {t('retryPreview')}
          </button>
        </div>
      )}
      <div
        aria-busy={state.rendering || (zoomed && state.detailRendering)}
        className={cn(
          'relative mx-auto aspect-[17/22] w-full overflow-hidden rounded-sm bg-muted shadow-md',
          viewportClassName
        )}
      >
        <div
          ref={viewport}
          data-board-inline-zoom
          role="region"
          aria-label={t('inlinePanPreview')}
          className="absolute inset-0 overflow-auto overscroll-contain"
        >
          {source && (
            <button
              ref={imageButton}
              data-board-preview-image
              type="button"
              disabled={!!state.previewError}
              aria-label={t(zoomed ? 'fitInlinePreview' : 'zoomInlinePreview')}
              title={t(zoomed ? 'inlinePanHint' : 'zoomInlinePreview')}
              className={cn(
                'relative block aspect-[17/22] max-w-none select-none rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                zoomed
                  ? dragging
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
                  : 'cursor-zoom-in touch-manipulation'
              )}
              style={{ width: `${state.inlineZoom}%` }}
              onClick={clickPreview}
              onPointerDown={startPan}
              onPointerMove={movePan}
              onPointerUp={endPan}
              onPointerCancel={endPan}
              onLostPointerCapture={endPan}
              onKeyDown={(event) => {
                if (!zoomed) return;
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  zoomTo(100);
                }
                const directions: Record<string, Point> = {
                  ArrowLeft: { x: -64, y: 0 },
                  ArrowRight: { x: 64, y: 0 },
                  ArrowUp: { x: 0, y: -64 },
                  ArrowDown: { x: 0, y: 64 },
                };
                const direction = directions[event.key];
                if (direction) {
                  event.preventDefault();
                  viewport.current?.scrollBy(direction.x, direction.y);
                }
              }}
            >
              {/* A shared canvas render keeps inline zoom identical to the printed board. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={source}
                width={2550}
                height={3300}
                alt={t('previewAlt')}
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
              />
            </button>
          )}
        </div>
        {children}
      </div>
    </>
  );
}
