'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
import { PhotoModeSwitch } from '@/components/photo-mode-switch';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function BoardAppearance({
  styles,
  photoMode,
  photoModeSaving = false,
  boardName,
  cards = [],
  showPreview = true,
  onSave,
}: {
  styles?: BoardStyleOptions | null;
  photoMode: PhotoMode;
  photoModeSaving?: boolean;
  boardName: string;
  cards?: LotteriaCard[];
  showPreview?: boolean;
  onSave: (settings: {
    name?: string;
    styleOptions?: BoardStyleOptions;
    photoMode?: PhotoMode;
  }) => Promise<boolean>;
}) {
  const t = useTranslations('Themes.Builder');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  const titleId = useId();
  const titleErrorId = useId();
  const titleInput = useRef<HTMLInputElement>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleError, setTitleError] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const titleValue = titleDraft ?? boardName;
  const titleChanged = titleValue !== boardName;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savingDesign, setSavingDesign] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const pendingSaves = useRef(0);
  const titleSavingRef = useRef(false);
  const selected = selectedBoardTheme(styles);

  async function save(settings: {
    name?: string;
    styleOptions?: BoardStyleOptions;
    photoMode?: PhotoMode;
  }) {
    const changesDesign = settings.name === undefined;
    pendingSaves.current += 1;
    setSaving(true);
    if (changesDesign) setSavingDesign(true);
    // A blur save must not swallow the setting the user clicks next. Serialize
    // the writes so full-board responses cannot restore an older title/design.
    const request = saveQueue.current.then(async () => {
      setError('');
      try {
        const saved = await onSave(settings);
        if (!saved) setError(t('saveError'));
        return saved;
      } catch {
        setError(t('saveError'));
        return false;
      } finally {
        pendingSaves.current -= 1;
        setSaving(pendingSaves.current > 0);
        if (changesDesign) setSavingDesign(false);
      }
    });
    saveQueue.current = request.then(() => {});
    return request;
  }

  useEffect(() => {
    if (!titleChanged) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [titleChanged]);

  async function saveTitle(focusInput = false) {
    if (titleSavingRef.current) return;
    const name = titleValue.trim();
    if (!name || name.length > 200) {
      setTitleError(t('titleValidation'));
      if (focusInput) titleInput.current?.focus();
      return;
    }
    setTitleError('');
    if (focusInput) titleInput.current?.focus();
    if (name === boardName) {
      setTitleDraft(null);
      return;
    }
    titleSavingRef.current = true;
    setSavingTitle(true);
    if (await save({ name })) {
      setTitleDraft(null);
    }
    titleSavingRef.current = false;
    setSavingTitle(false);
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
          <fieldset disabled={savingDesign} className="space-y-5">
            <legend className="sr-only">{t('chooseTheme')}</legend>
            <BoardThemePicker
              selected={selected}
              saving={savingDesign}
              error={error}
              onSelect={async (presetId) => {
                const saved = await save({
                  styleOptions: {
                    ...(presetId === 'custom'
                      ? styles?.customDesign
                        ? {}
                        : editableBoardStyle(styles ?? {})
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
              boardName={boardName}
              disabled={savingDesign}
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
            <PhotoModeSwitch
              photoMode={photoMode}
              saving={photoModeSaving}
              disabled={savingDesign}
              onChange={(mode) => void save({ photoMode: mode })}
            />
          </fieldset>
          <div className="mt-3 border-t border-border pt-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={styles?.showTitle ?? false}
                disabled={savingDesign}
                onChange={(event) =>
                  void save({ styleOptions: { ...styles, showTitle: event.target.checked } })
                }
                className="h-5 w-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              {t('showTitle')}
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveTitle(true);
              }}
              noValidate
              className="mt-1 max-w-xl"
            >
              <label htmlFor={titleId} className="sr-only">
                {t('boardTitle')}
              </label>
              <div className="flex min-w-0 items-center gap-2">
                <Input
                  ref={titleInput}
                  id={titleId}
                  name="boardTitle"
                  autoComplete="off"
                  value={titleValue}
                  readOnly={saving}
                  aria-invalid={!!titleError}
                  aria-describedby={titleError ? titleErrorId : undefined}
                  onBlur={() => {
                    if (titleChanged) void saveTitle();
                  }}
                  onChange={(event) => {
                    setTitleDraft(event.target.value);
                    setTitleError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && !saving) {
                      setTitleDraft(null);
                      setTitleError('');
                    }
                  }}
                  className="h-11 flex-1 bg-background text-base"
                />
                {(titleChanged || savingTitle) && (
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={saving}
                    className="min-h-11 shrink-0 touch-manipulation"
                  >
                    {savingTitle && (
                      <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    )}
                    {t('saveTitle')}
                  </Button>
                )}
              </div>
              {titleError && (
                <p id={titleErrorId} role="alert" className="mt-2 text-sm text-destructive">
                  {titleError}
                </p>
              )}
            </form>
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
