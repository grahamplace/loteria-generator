'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image, { getImageProps } from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { themePresets, type BoardStyleOptions, type PhotoMode } from '@/lib/themes/presets';
import { renderBoardToCanvas, type LotteriaCard } from '@/lib/generate-boards';
import { Button } from '@/components/ui/button';
import { cardImageProps, CARD_GRID_THUMB_WIDTH } from '@/lib/card-image';
import { Loader2, Check } from 'lucide-react';

export function BoardAppearance({
  styles,
  photoMode,
  boardName,
  cards,
  onSave,
}: {
  styles?: BoardStyleOptions | null;
  photoMode: PhotoMode;
  boardName: string;
  cards: LotteriaCard[];
  onSave: (settings: {
    styleOptions?: BoardStyleOptions;
    photoMode?: PhotoMode;
  }) => Promise<boolean>;
}) {
  const t = useTranslations('Themes.Builder');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  const titleHelpId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [rendering, setRendering] = useState(true);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const previewImages = useRef(new Map<string, Promise<HTMLImageElement>>());
  const selected = styles?.presetId ?? 'classic';
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

  async function save(settings: { styleOptions?: BoardStyleOptions; photoMode?: PhotoMode }) {
    setSaving(true);
    setError('');
    try {
      if (!(await onSave(settings))) setError(t('saveError'));
    } catch {
      setError(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5" aria-label={t('title')}>
      <div className="mb-4 flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
        <h2 className="font-display text-lg font-semibold">{t('title')}</h2>
        <span className="text-sm text-muted-foreground">
          {themePresets.find((p) => p.id === selected)?.name[locale]}
        </span>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div className="min-w-0">
          <fieldset disabled={saving} className="space-y-5">
            <legend className="sr-only">{t('chooseTheme')}</legend>
            <div
              role="radiogroup"
              aria-label={t('chooseTheme')}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4"
            >
              {themePresets.map((preset) => (
                <label
                  key={preset.id}
                  className={`relative flex min-h-14 min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors has-[:disabled]:cursor-wait has-[:disabled]:opacity-60 sm:gap-3 ${selected === preset.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background/60 hover:border-primary/50 hover:bg-background'}`}
                >
                  <input
                    type="radio"
                    name="board-preset"
                    value={preset.id}
                    checked={selected === preset.id}
                    onChange={() =>
                      void save({
                        styleOptions: {
                          ...styles,
                          presetId: preset.id,
                          showTitle: styles?.showTitle ?? preset.id !== 'classic',
                        },
                      })
                    }
                    className="peer sr-only"
                  />
                  <span className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary" />
                  <span className="relative w-6 shrink-0 sm:w-8">
                    <Image
                      src={`/themes/picker/${preset.id}.webp`}
                      width={32}
                      height={42}
                      alt=""
                      unoptimized
                      className="h-auto w-full rounded-sm border border-foreground/10 shadow-sm"
                    />
                    {selected === preset.id && (
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[0.8125rem] font-medium leading-tight text-foreground sm:text-sm">
                    {preset.name[locale]}
                  </span>
                </label>
              ))}
            </div>
            <div>
              <label htmlFor="photo-mode" className="block font-medium mb-2">
                {t('photoMode')}
              </label>
              <select
                id="photo-mode"
                value={photoMode}
                onChange={(event) => void save({ photoMode: event.target.value as PhotoMode })}
                className="min-h-11 rounded-md border border-input bg-background text-foreground px-3 text-base focus-visible:outline-2 focus-visible:outline-primary"
              >
                <option value="illustrated">{t('illustrated')}</option>
                <option value="original">{t('original')}</option>
              </select>
              <p className="mt-2 text-sm text-muted-foreground">{t('futureUploads')}</p>
            </div>
          </fieldset>
          <div className="mt-3 border-t border-border pt-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={styles?.showTitle ?? false}
                disabled={saving}
                aria-describedby={titleHelpId}
                onChange={(event) =>
                  void save({ styleOptions: { ...styles, showTitle: event.target.checked } })
                }
                className="h-5 w-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              {t('showTitle')}
            </label>
            <p id={titleHelpId} className="ml-8 break-words text-sm text-muted-foreground">
              {t('printedTitle', { name: boardName })}
            </p>
          </div>
          <div className="mt-3 flex min-h-5 flex-wrap items-center gap-3">
            {saving && (
              <span role="status" className="flex gap-2 text-sm">
                <Loader2
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {t('saving')}
              </span>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>
        <aside
          aria-label={t('livePreview')}
          className="w-full min-w-0 max-w-sm justify-self-center rounded-xl border border-border bg-muted/30 p-3 lg:sticky lg:top-24"
        >
          <h3 className="mb-3 text-sm font-medium">{t('livePreview')}</h3>
          <div
            className="relative aspect-[17/22] overflow-hidden rounded-sm bg-muted shadow-md"
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewAttempt((attempt) => attempt + 1)}
                >
                  {t('retryPreview')}
                </Button>
              </div>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t(
              complete.length === 0
                ? 'emptyPreview'
                : complete.length < 16
                  ? 'partialPreview'
                  : 'fullPreview'
            )}
          </p>
        </aside>
      </div>
    </section>
  );
}
