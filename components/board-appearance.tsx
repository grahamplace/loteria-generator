'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  themePresets,
  selectedBoardTheme,
  type BoardDesignValues,
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
import { ChevronDown, Loader2 } from 'lucide-react';

/** Quiet period after the last in-progress edit before it is saved. */
const DESIGN_SAVE_DELAY_MS = 400;

export function BoardAppearance({
  styles,
  photoMode,
  photoModeSaving = false,
  boardName,
  cards = [],
  showPreview = true,
  onDraftStylesChange,
  onSave,
}: {
  styles?: BoardStyleOptions | null;
  photoMode: PhotoMode;
  photoModeSaving?: boolean;
  boardName: string;
  cards?: LotteriaCard[];
  showPreview?: boolean;
  /** Unsaved design shown while edits settle; null once saved or reverted. */
  onDraftStylesChange?: (styles: BoardStyleOptions | null) => void;
  onSave: (settings: {
    name?: string;
    styleOptions?: BoardStyleOptions;
    photoMode?: PhotoMode;
  }) => Promise<boolean>;
}) {
  const t = useTranslations('Themes.Builder');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  const search = useSearchParams();
  const open = search.get('designPanel') !== 'closed';
  const contentId = useId();
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
  // Design changes show immediately and save in the background. The draft is
  // what the controls and preview render until the board catches up.
  const [draftStyles, setDraftStyles] = useState<BoardStyleOptions | null>(null);
  const draftRef = useRef<BoardStyleOptions | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownStyles = draftStyles ?? styles;
  const selected = selectedBoardTheme(shownStyles);
  const reportDraft = useRef(onDraftStylesChange);
  reportDraft.current = onDraftStylesChange;

  useEffect(() => {
    reportDraft.current?.(draftStyles);
  }, [draftStyles]);

  useEffect(() => {
    if (!draftStyles) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [draftStyles]);

  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    },
    []
  );

  function setDraft(next: BoardStyleOptions | null) {
    draftRef.current = next;
    setDraftStyles(next);
  }

  function customDesign(patch: Partial<BoardDesignValues>): BoardStyleOptions {
    const current = draftRef.current ?? styles ?? {};
    return {
      ...editableBoardStyle(current),
      ...patch,
      presetId: 'custom',
      showTitle: current.showTitle ?? false,
    };
  }

  function previewDesign(patch: Partial<BoardDesignValues>) {
    setDraft(customDesign(patch));
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(flushDesign, DESIGN_SAVE_DELAY_MS);
  }

  function flushDesign() {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = null;
    if (draftRef.current) void save({ styleOptions: draftRef.current }, false);
  }

  function commitDesign(patch: Partial<BoardDesignValues>) {
    const next = customDesign(patch);
    const current = editableBoardStyle(draftRef.current ?? styles ?? {});
    const unchanged =
      !persistTimer.current &&
      selectedBoardTheme(draftRef.current ?? styles) === 'custom' &&
      (Object.keys(patch) as (keyof BoardDesignValues)[]).every(
        (key) => String(current[key]).toLowerCase() === String(next[key]).toLowerCase()
      );
    if (unchanged) return;
    setDraft(next);
    flushDesign();
  }

  function togglePanel() {
    const url = new URL(window.location.href);
    if (open) {
      url.searchParams.set('designPanel', 'closed');
      url.searchParams.delete('themePicker');
    } else {
      url.searchParams.delete('designPanel');
    }
    window.history.pushState(null, '', url);
  }

  async function save(
    settings: {
      name?: string;
      styleOptions?: BoardStyleOptions;
      photoMode?: PhotoMode;
    },
    // Lock the controls only for whole-theme changes; edits stay interactive.
    lock = true
  ) {
    const changesDesign = settings.name === undefined && lock;
    if (settings.styleOptions) {
      if (persistTimer.current && lock) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      setDraft(settings.styleOptions);
    }
    pendingSaves.current += 1;
    setSaving(true);
    if (changesDesign) setSavingDesign(true);
    // A blur save must not swallow the setting the user clicks next. Serialize
    // the writes so full-board responses cannot restore an older title/design.
    const request = saveQueue.current.then(async () => {
      setError('');
      let saved = false;
      try {
        saved = await onSave(settings);
        if (!saved) setError(t('saveError'));
        return saved;
      } catch {
        setError(t('saveError'));
        return false;
      } finally {
        pendingSaves.current -= 1;
        setSaving(pendingSaves.current > 0);
        if (changesDesign) setSavingDesign(false);
        if (settings.styleOptions && !saved) {
          // Show the board as saved rather than a design that didn't persist.
          if (persistTimer.current) clearTimeout(persistTimer.current);
          persistTimer.current = null;
          setDraft(null);
        } else if (pendingSaves.current === 0 && !persistTimer.current) {
          setDraft(null);
        }
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
    <section className="rounded-xl border border-border bg-card" aria-label={t('title')}>
      <h2>
        <button
          type="button"
          aria-label={t('title')}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={togglePanel}
          className="flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:px-5"
        >
          <span className="min-w-0 flex-1 font-display text-lg font-semibold">{t('title')}</span>
          <span className="max-w-[40%] truncate text-sm font-normal text-muted-foreground">
            {selected === 'custom'
              ? t('custom')
              : themePresets.find((p) => p.id === selected)?.name[locale]}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0 transition-transform motion-reduce:transition-none',
              open && 'rotate-180'
            )}
          />
        </button>
      </h2>
      <div
        id={contentId}
        hidden={!open}
        className={cn(
          'items-start gap-6 px-4 pb-4 pt-2 md:px-5 md:pb-5',
          open ? 'grid' : 'hidden',
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
                      ? shownStyles?.customDesign
                        ? {}
                        : editableBoardStyle(shownStyles ?? {})
                      : presetBoardStyle(presetId)),
                    presetId,
                    showTitle: shownStyles?.showTitle ?? presetId !== 'classic',
                  },
                });
                if (saved && presetId === 'custom') openDesignControls();
                return saved;
              }}
            />
            <BoardDesignControls
              styles={shownStyles}
              boardName={boardName}
              disabled={savingDesign}
              onPreview={previewDesign}
              onChange={commitDesign}
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
                checked={shownStyles?.showTitle ?? false}
                disabled={savingDesign}
                onChange={(event) =>
                  void save({ styleOptions: { ...shownStyles, showTitle: event.target.checked } })
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
        </div>
        {showPreview && <BoardPreview styles={shownStyles} boardName={boardName} cards={cards} />}
      </div>
      {(saving || error || (!open && titleError)) && (
        <div className="flex min-h-5 flex-wrap items-center gap-3 px-4 pb-4 md:px-5 md:pb-5">
          {saving && (
            <span role="status" className="flex gap-2 text-sm">
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {t('saving')}
            </span>
          )}
          {(error || (!open && titleError)) && (
            <p role="alert" className="text-sm text-destructive">
              {error || titleError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
