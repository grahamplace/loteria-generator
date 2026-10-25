'use client';

import { useState, type Ref, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Palette, X } from 'lucide-react';
import type { BoardThemeId } from '@/lib/themes/presets';
import type { BoardDesign } from '@/hooks/use-board-design';
import { BoardThemeGrid, ThemeThumbnail, useThemeName } from '@/components/board-theme-grid';
import { BoardDesignControls, type DesignLayout } from '@/components/board-design-controls';
import { BoardPreviewImage, type useBoardPreview } from '@/components/board-preview';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/** `?design=1` opens "Design your set": the dialog on desktop, the sheet's design view on phones. */
export const DESIGN_PARAM = 'design';

export function openDesignControls() {
  const url = new URL(window.location.href);
  url.searchParams.set(DESIGN_PARAM, '1');
  window.history.pushState(null, '', url);
}

export function closeDesignControls() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(DESIGN_PARAM)) return;
  url.searchParams.delete(DESIGN_PARAM);
  window.history.replaceState(null, '', url);
}

type PreviewState = ReturnType<typeof useBoardPreview>;

/** Escape belongs to a color field (revert, or close the OS chooser), not its dialog. */
export function isFieldEscape(event: KeyboardEvent) {
  return event.target instanceof Element && !!event.target.closest('[data-color-control]');
}

export function DesignSaveStatus({ design }: { design: BoardDesign }) {
  const t = useTranslations('Themes.Builder');
  if (design.error) {
    return (
      <p role="alert" className="text-xs font-medium text-destructive">
        {design.error}
      </p>
    );
  }
  return (
    <span
      role="status"
      className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
    >
      {design.saving ? (
        <>
          <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {t('saving')}
        </>
      ) : (
        <>
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          {t('saved')}
        </>
      )}
    </span>
  );
}

/** Theme tiles plus the collapsible Customize card, shared by the dialog and the sheet. */
export function BoardDesignEditor({
  design,
  boardName,
  layout,
}: {
  design: BoardDesign;
  boardName: string;
  layout: DesignLayout;
}) {
  const t = useTranslations('Themes.Builder');
  // Opens on its own for a custom design, the one place its controls matter most.
  const [customizeOpen, setCustomizeOpen] = useState(design.selected === 'custom');
  const [pending, setPending] = useState<BoardThemeId | null>(null);

  async function select(id: BoardThemeId) {
    if (pending || design.savingDesign) return;
    if (id === 'custom') setCustomizeOpen(true);
    if (id === design.selected) return;
    setPending(id);
    try {
      await design.selectTheme(id);
    } finally {
      setPending(null);
    }
  }

  return (
    <fieldset disabled={design.savingDesign} className="min-w-0 space-y-5">
      <legend className="sr-only">{t('title')}</legend>
      <BoardThemeGrid
        selected={design.selected}
        pending={pending}
        layout={layout === 'dialog' ? 'grid' : 'list'}
        onSelect={(id) => void select(id)}
      />
      <BoardDesignControls
        styles={design.shownStyles}
        boardName={boardName}
        disabled={design.savingDesign}
        open={customizeOpen}
        layout={layout}
        onOpenChange={setCustomizeOpen}
        onPreview={design.previewDesign}
        onChange={design.commitDesign}
        onShowTitleChange={(showTitle) => void design.setShowTitle(showTitle)}
      />
    </fieldset>
  );
}

/**
 * The current theme beside the preview. `compact` is the desktop sidebar row
 * with its own button; `row` makes the whole row the phone-sized target.
 */
export function BoardThemeRow({
  design,
  variant,
  onChange,
  ref,
}: {
  design: BoardDesign;
  variant: 'compact' | 'row';
  onChange: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  const t = useTranslations('Themes.Builder');
  const themeName = useThemeName();
  const name = themeName(design.selected);
  const text = (
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        {t('theme')}
      </span>
      <span
        className={cn(
          'block truncate font-semibold',
          variant === 'row' ? 'text-[15px]' : 'text-sm'
        )}
      >
        {name}
      </span>
    </span>
  );
  if (variant === 'row') {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onChange}
        aria-label={t('changeTheme', { name })}
        className="flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <ThemeThumbnail id={design.selected} className="h-[34px] w-11" />
        {text}
        <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-primary">
          {t('change')}
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <ThemeThumbnail id={design.selected} className="h-[34px] w-11" />
      {text}
      <Button
        ref={ref}
        type="button"
        variant="outline"
        onClick={onChange}
        aria-label={t('changeTheme', { name })}
        className="min-h-11 shrink-0 touch-manipulation px-3 text-[13px] font-semibold transition-colors"
      >
        <Palette aria-hidden="true" />
        {t('changeEllipsis')}
      </Button>
    </div>
  );
}

/** Desktop "Design your set": live preview on the left, choices on the right. */
export function BoardDesignDialog({
  open,
  onOpenChange,
  design,
  preview,
  boardName,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  design: BoardDesign;
  preview: PreviewState;
  boardName: string;
  /** Opened from the URL rather than a Radix trigger, so name where focus returns. */
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations('Themes.Builder');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-board-preview
        onEscapeKeyDown={(event) => {
          if (isFieldEscape(event)) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus({ preventScroll: true });
        }}
        className="flex h-[min(860px,calc(100dvh-3rem))] w-[calc(100%-3rem)] max-w-[1060px] gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-[1060px] motion-reduce:animate-none"
      >
        <section
          aria-label={t('livePreview')}
          className="flex w-[min(380px,38%)] shrink-0 flex-col gap-3.5 overflow-y-auto overscroll-contain border-r border-border bg-muted p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold tracking-widest text-muted-foreground uppercase">
              {t('livePreview')}
            </h3>
            <DesignSaveStatus design={design} />
          </div>
          <BoardPreviewImage state={preview} fitViewport />
          <p className="text-center text-xs text-muted-foreground">{t('cardsNeverChange')}</p>
        </section>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3">
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold">{t('title')}</DialogTitle>
              <DialogDescription className="mt-1 text-[13px]">
                {t('designSubtitle')}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('closeDesign')}
                className="size-11 shrink-0 touch-manipulation transition-colors"
              >
                <X aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
          <div className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-1 pb-4">
            <BoardDesignEditor design={design} boardName={boardName} layout="dialog" />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3.5">
            <span className="text-xs text-muted-foreground">{t('savesAutomatically')}</span>
            <DialogClose asChild>
              <Button type="button" className="min-h-11 px-6 touch-manipulation transition-colors">
                {t('done')}
              </Button>
            </DialogClose>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

/** The phone sheet's design view: back arrow, sticky preview strip, choices, Done. */
export function BoardDesignSheetView({
  design,
  preview,
  boardName,
  onBack,
  backRef,
}: {
  design: BoardDesign;
  preview: PreviewState;
  boardName: string;
  onBack: () => void;
  backRef?: Ref<HTMLButtonElement>;
}) {
  const t = useTranslations('Themes.Builder');
  const themeName = useThemeName();
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 py-2 pr-14 pl-2">
        <Button
          ref={backRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('backToPreview')}
          onClick={onBack}
          className="size-11 shrink-0 touch-manipulation transition-colors"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Button>
        <SheetTitle className="min-w-0 flex-1 text-lg font-bold">{t('title')}</SheetTitle>
        <DesignSaveStatus design={design} />
      </div>
      <div className="flex shrink-0 items-center gap-3 border-y border-border bg-muted px-4 py-2.5">
        <div className="relative w-24 shrink-0">
          {preview.preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a rendered data URL
            <img
              src={preview.preview}
              alt={t('previewAlt')}
              className="h-auto w-full rounded-sm shadow-md"
            />
          ) : (
            <div className="aspect-[17/22] w-full rounded-sm bg-background" />
          )}
          {preview.rendering && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2
                className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
                aria-hidden="true"
              />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            {t('livePreview')}
          </p>
          <p className="truncate font-bold">{themeName(design.selected)}</p>
          <p className="text-xs text-muted-foreground">{t('cardsStaySame')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          data-board-preview-expand
          aria-label={t('expandPreview')}
          disabled={!preview.preview || !!preview.previewError}
          onClick={preview.expand}
          className="size-11 shrink-0 touch-manipulation transition-colors"
        >
          <Maximize2 aria-hidden="true" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3.5 pb-4">
        <BoardDesignEditor design={design} boardName={boardName} layout="sheet" />
      </div>
      <div className="shrink-0 border-t border-border px-4 pt-3 pb-3">
        <Button
          type="button"
          onClick={onBack}
          className="min-h-12 w-full touch-manipulation text-[15px] transition-colors"
        >
          {t('done')}
        </Button>
      </div>
    </>
  );
}
