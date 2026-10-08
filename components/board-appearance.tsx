'use client';

import { useEffect, useId, useState, type CSSProperties } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  themePresets,
  themeVariables,
  type BoardStyleOptions,
  type PhotoMode,
} from '@/lib/themes/presets';
import { renderBoardToCanvas, type LotteriaCard } from '@/lib/generate-boards';
import { Button } from '@/components/ui/button';
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const selected = styles?.presetId ?? 'classic';
  const complete = cards
    .filter((card) => !card.isProcessing && !card.error && card.illustration)
    .slice(0, 16);
  const signature = JSON.stringify([complete, styles, boardName]);

  useEffect(() => {
    if (!previewOpen || complete.length === 0) return;
    let cancelled = false;
    setPreview(null);
    setPreviewError('');
    renderBoardToCanvas(
      complete,
      styles ?? {},
      complete.length < 16
        ? [locale === 'es-MX' ? 'Muestra' : 'Sample', styles?.showTitle ? boardName : undefined]
            .filter(Boolean)
            .join(' · ')
        : styles?.showTitle
          ? boardName
          : undefined
    )
      .then((canvas) => {
        if (!cancelled) setPreview(canvas.toDataURL('image/jpeg', 0.7));
      })
      .catch(() => {
        if (!cancelled) setPreviewError(t('previewError'));
      });
    return () => {
      cancelled = true;
    };
    // Render only when the serialized print inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, previewOpen]);

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
      <details>
        <summary className="cursor-pointer min-h-11 py-2 font-display text-lg font-semibold focus-visible:outline-2 focus-visible:outline-primary">
          {t('title')}{' '}
          <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
            {themePresets.find((p) => p.id === selected)?.name[locale]}
          </span>
        </summary>
        <fieldset disabled={saving} className="mt-4 space-y-5">
          <legend className="sr-only">{t('chooseTheme')}</legend>
          <div
            role="radiogroup"
            aria-label={t('chooseTheme')}
            className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-6"
          >
            {themePresets.map((preset) => (
              <label
                key={preset.id}
                style={themeVariables(preset.id) as CSSProperties}
                className={`theme-surface relative cursor-pointer rounded-md border-2 p-3 min-h-20 ${selected === preset.id ? 'border-primary ring-2 ring-primary/25' : 'border-border'}`}
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
                <span className="absolute inset-0 rounded-md peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary" />
                <span className="theme-heading text-lg">{preset.name[locale]}</span>
                {selected === preset.id && (
                  <Check className="absolute bottom-2 right-2 h-4 w-4" aria-hidden="true" />
                )}
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
      </details>
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
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={!complete.length || saving}
          onClick={() => setPreviewOpen(!previewOpen)}
        >
          {previewOpen ? t('hidePreview') : t('preview')}
        </Button>
        {saving && (
          <span role="status" className="flex gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('saving')}
          </span>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      {previewOpen && (
        <div className="mt-4 max-w-md mx-auto">
          {previewError ? (
            <p role="alert">{previewError}</p>
          ) : preview ? (
            <>
              {/* The image is an in-memory canvas of the actual PDF renderer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                width={2550}
                height={3300}
                alt={t('previewAlt')}
                className="w-full h-auto shadow-lg"
              />
              {complete.length < 16 && (
                <p className="mt-2 text-sm text-muted-foreground">{t('partialPreview')}</p>
              )}
            </>
          ) : (
            <p role="status" className="py-8 text-center">
              {t('rendering')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
