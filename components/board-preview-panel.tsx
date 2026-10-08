'use client';

import { useEffect, useState } from 'react';
import { Eye, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BoardPreviewImage, useBoardPreview } from '@/components/board-preview';
import {
  BoardDownloadControls,
  useBoardDownload,
  type BoardDownloadProps,
} from '@/components/board-download-controls';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function BoardPreviewPanel({
  onAddPhotos,
  canAddPhotos,
  ...props
}: BoardDownloadProps & { onAddPhotos: () => void; canAddPhotos: boolean }) {
  const t = useTranslations('Themes.Builder');
  const [open, setOpen] = useState(false);
  // Both surfaces share the renderer, image cache, board count, and in-flight download.
  const preview = useBoardPreview(props);
  const download = useBoardDownload(props);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <>
      <aside
        aria-label={t('livePreview')}
        className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] min-w-0 self-start overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-4 shadow-sm lg:block"
      >
        <h2 className="mb-3 font-display text-lg font-semibold">{t('livePreview')}</h2>
        <BoardPreviewImage state={preview} fitViewport />
        <div className="mt-4">
          <BoardDownloadControls state={download} />
        </div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
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
              <Button className="min-h-11 min-w-0 flex-1 touch-manipulation whitespace-normal transition-colors">
                <Eye aria-hidden="true" />
                {t('previewAndDownload')}
              </Button>
            </SheetTrigger>
          </div>
        </div>
        <SheetContent
          side="bottom"
          closeLabel={t('closePreview')}
          className="max-h-[92dvh] gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)] motion-reduce:animate-none"
        >
          <SheetHeader className="shrink-0 pr-16">
            <SheetTitle>{t('livePreview')}</SheetTitle>
            <SheetDescription>{t('previewDescription')}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
            <div className="mx-auto max-w-sm">
              <BoardPreviewImage state={preview} />
            </div>
          </div>
          <div className="shrink-0 bg-background px-4 pb-4">
            <div className="mx-auto max-w-sm">
              <BoardDownloadControls state={download} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
