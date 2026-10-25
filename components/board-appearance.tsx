'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { BoardStyleOptions, PhotoMode } from '@/lib/themes/presets';
import type { LotteriaCard } from '@/lib/generate-boards';
import { useBoardDesign, type BoardSettings } from '@/hooks/use-board-design';
import { BoardPreview } from '@/components/board-preview';
import { BoardDesignEditor, DesignSaveStatus } from '@/components/board-design';
import { PhotoModeSwitch } from '@/components/photo-mode-switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Admin board settings: the shared design editor inline beside a preview, plus
 * the photo mode and title the admin page has no other place to change.
 * Consumers design from the board page's preview sidebar instead.
 */
export function BoardAppearance({
  styles,
  photoMode,
  photoModeSaving = false,
  boardName,
  cards = [],
  onSave,
}: {
  styles?: BoardStyleOptions | null;
  photoMode: PhotoMode;
  photoModeSaving?: boolean;
  boardName: string;
  cards?: LotteriaCard[];
  onSave: (settings: BoardSettings) => Promise<boolean>;
}) {
  const t = useTranslations('Themes.Builder');
  const design = useBoardDesign({ styles, onSave });
  const titleId = useId();
  const titleErrorId = useId();
  const titleInput = useRef<HTMLInputElement>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleError, setTitleError] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const titleSavingRef = useRef(false);
  const titleValue = titleDraft ?? boardName;
  const titleChanged = titleValue !== boardName;

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
    if (await design.save({ name })) setTitleDraft(null);
    titleSavingRef.current = false;
    setSavingTitle(false);
  }

  return (
    <section
      className="grid items-start gap-6 rounded-xl border border-border bg-card p-4 md:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]"
      aria-label={t('title')}
    >
      <div className="min-w-0 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{t('title')}</h2>
          <DesignSaveStatus design={design} />
        </div>
        <div className="@container">
          <BoardDesignEditor design={design} boardName={boardName} layout="dialog" />
        </div>
        <PhotoModeSwitch
          photoMode={photoMode}
          saving={photoModeSaving}
          disabled={design.savingDesign}
          onChange={(mode) => void design.save({ photoMode: mode })}
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveTitle(true);
          }}
          noValidate
          className="max-w-xl"
        >
          <label htmlFor={titleId} className="mb-1.5 block text-sm font-medium">
            {t('boardTitle')}
          </label>
          <div className="flex min-w-0 items-center gap-2">
            <Input
              ref={titleInput}
              id={titleId}
              name="boardTitle"
              autoComplete="off"
              value={titleValue}
              readOnly={design.saving}
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
                if (event.key === 'Escape' && !design.saving) {
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
                disabled={design.saving}
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
      <BoardPreview styles={design.shownStyles} boardName={boardName} cards={cards} />
    </section>
  );
}
