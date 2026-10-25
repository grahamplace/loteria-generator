'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  selectedBoardTheme,
  type BoardDesignValues,
  type BoardStyleOptions,
  type BoardThemeId,
  type PhotoMode,
} from '@/lib/themes/presets';
import { editableBoardStyle, presetBoardStyle } from '@/lib/themes/render-style';

/** Quiet period after the last in-progress edit before it is saved. */
export const DESIGN_SAVE_DELAY_MS = 400;

export interface BoardSettings {
  name?: string;
  styleOptions?: BoardStyleOptions;
  photoMode?: PhotoMode;
}

/**
 * Draft, debounce, and save logic shared by every surface that edits a board's
 * design. Edits show immediately; in-progress edits save after a quiet period,
 * and all writes are serialized so a slow response cannot restore an older design.
 */
export function useBoardDesign({
  styles,
  onSave,
  onDraftStylesChange,
}: {
  styles?: BoardStyleOptions | null;
  onSave: (settings: BoardSettings) => Promise<boolean>;
  /** Unsaved design shown while edits settle; null once saved or reverted. */
  onDraftStylesChange?: (styles: BoardStyleOptions | null) => void;
}) {
  const t = useTranslations('Themes.Builder');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savingDesign, setSavingDesign] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const pendingSaves = useRef(0);
  // The draft is what controls and previews render until the board catches up.
  const [draftStyles, setDraftStyles] = useState<BoardStyleOptions | null>(null);
  const draftRef = useRef<BoardStyleOptions | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownStyles = draftStyles ?? styles;
  const selected = selectedBoardTheme(shownStyles);
  const reportDraft = useRef(onDraftStylesChange);
  const saveSettings = useRef(onSave);
  useEffect(() => {
    reportDraft.current = onDraftStylesChange;
    saveSettings.current = onSave;
  });

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

  async function save(
    settings: BoardSettings,
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
    const request = saveQueue.current.then(async () => {
      setError('');
      let saved = false;
      try {
        saved = await saveSettings.current(settings);
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

  function flushDesign() {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = null;
    if (draftRef.current) void save({ styleOptions: draftRef.current }, false);
  }

  /** Show an in-progress edit right away; save it once edits settle. */
  function previewDesign(patch: Partial<BoardDesignValues>) {
    setDraft(customDesign(patch));
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(flushDesign, DESIGN_SAVE_DELAY_MS);
  }

  /**
   * Save a finished edit now, unless it only repeats what is already saved.
   * Leaving a field untouched keeps a preset; it does not become Custom.
   */
  function commitDesign(patch: Partial<BoardDesignValues>) {
    const next = customDesign(patch);
    const current = editableBoardStyle(draftRef.current ?? styles ?? {});
    const unchanged =
      !persistTimer.current &&
      (Object.keys(patch) as (keyof BoardDesignValues)[]).every(
        (key) => String(current[key]).toLowerCase() === String(next[key]).toLowerCase()
      );
    if (unchanged) return;
    setDraft(next);
    flushDesign();
  }

  /** Start fresh from a preset, or restore the board's last custom design. */
  function selectTheme(presetId: BoardThemeId) {
    return save({
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
  }

  function setShowTitle(showTitle: boolean) {
    return save({ styleOptions: { ...shownStyles, showTitle } });
  }

  return {
    shownStyles,
    selected,
    /** Any save is in flight. */
    saving,
    /** A whole-theme change is in flight; the controls are locked meanwhile. */
    savingDesign,
    error,
    save,
    previewDesign,
    commitDesign,
    selectTheme,
    setShowTitle,
  };
}

export type BoardDesign = ReturnType<typeof useBoardDesign>;
