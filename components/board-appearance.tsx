'use client';

import { useId, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  themePresets,
  selectedBoardTheme,
  type BoardStyleOptions,
  type PhotoMode,
} from '@/lib/themes/presets';
import type { LotteriaCard } from '@/lib/generate-boards';
import { BoardPreview } from '@/components/board-preview';
import { editableBoardStyle, presetBoardStyle } from '@/lib/themes/render-style';
import { BoardDesignControls, openDesignControls } from '@/components/board-design-controls';
import { BoardThemePicker } from '@/components/board-theme-picker';
import { cn } from '@/lib/utils';
import { Loader2, ChevronDown } from 'lucide-react';

export function BoardAppearance({
  styles,
  photoMode,
  boardName,
  cards = [],
  showPreview = true,
  onSave,
}: {
  styles?: BoardStyleOptions | null;
  photoMode: PhotoMode;
  boardName: string;
  cards?: LotteriaCard[];
  showPreview?: boolean;
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
  const savingRef = useRef(false);
  const selected = selectedBoardTheme(styles);

  async function save(settings: { styleOptions?: BoardStyleOptions; photoMode?: PhotoMode }) {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const saved = await onSave(settings);
      if (!saved) setError(t('saveError'));
      return saved;
    } catch {
      setError(t('saveError'));
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5" aria-label={t('title')}>
      <div className="mb-4 flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
        <h2 className="font-display text-lg font-semibold">{t('title')}</h2>
        <span className="hidden text-sm text-muted-foreground lg:inline">
          {selected === 'custom'
            ? t('custom')
            : themePresets.find((p) => p.id === selected)?.name[locale]}
        </span>
      </div>
      <div
        className={cn(
          'grid items-start gap-6',
          showPreview && 'lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]'
        )}
      >
        <div className="min-w-0">
          <fieldset disabled={saving} className="space-y-5">
            <legend className="sr-only">{t('chooseTheme')}</legend>
            <BoardThemePicker
              selected={selected}
              saving={saving}
              error={error}
              onSelect={async (presetId) => {
                const saved = await save({
                  styleOptions: {
                    ...(presetId === 'custom'
                      ? editableBoardStyle(styles ?? {})
                      : presetBoardStyle(presetId)),
                    presetId,
                    showTitle: styles?.showTitle ?? presetId !== 'classic',
                  },
                });
                if (saved && presetId === 'custom') openDesignControls();
                return saved;
              }}
            />
            <BoardDesignControls
              styles={styles}
              onChange={(patch) =>
                void save({
                  styleOptions: {
                    ...editableBoardStyle(styles ?? {}),
                    ...patch,
                    presetId: 'custom',
                    showTitle: styles?.showTitle ?? false,
                  },
                })
              }
            />
            <div>
              <label htmlFor="photo-mode" className="block font-medium mb-2">
                {t('photoMode')}
              </label>
              <div className="relative w-fit max-w-full">
                <select
                  id="photo-mode"
                  name="photoMode"
                  value={photoMode}
                  onChange={(event) => void save({ photoMode: event.target.value as PhotoMode })}
                  className="min-h-11 max-w-full appearance-none touch-manipulation rounded-md border border-input bg-background pl-3 pr-10 text-base text-foreground transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
                >
                  <option value="illustrated">{t('illustrated')}</option>
                  <option value="original">{t('original')}</option>
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
              </div>
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
        {showPreview && <BoardPreview styles={styles} boardName={boardName} cards={cards} />}
      </div>
    </section>
  );
}
