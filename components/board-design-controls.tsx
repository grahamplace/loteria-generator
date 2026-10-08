'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  borderStyles,
  printFonts,
  type BoardDesignValues,
  type BoardStyleOptions,
} from '@/lib/themes/presets';
import { editableBoardStyle } from '@/lib/themes/render-style';
import { cn } from '@/lib/utils';

export function openDesignControls() {
  const url = new URL(window.location.href);
  url.searchParams.set('design', '1');
  window.history.pushState(null, '', url);
}

const selectClassName =
  'min-h-11 w-full min-w-0 appearance-none touch-manipulation rounded-md border border-input bg-background pl-3 pr-10 text-base text-foreground hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60';
const colorKeys = [
  'backgroundColor',
  'badgeColor',
  'numberColor',
  'labelColor',
  'borderColor',
] as const;

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const t = useTranslations('Themes.Builder');
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const commit = useRef(onChange);
  commit.current = onChange;
  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);
  useEffect(() => {
    const input = picker.current;
    // Native change fires when the color is committed, unlike React's onChange,
    // which also fires on every input while dragging the OS color picker.
    const change = () => {
      if (input) commit.current(input.value);
    };
    input?.addEventListener('change', change);
    return () => input?.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (draft.toLowerCase() === value.toLowerCase()) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [draft, value]);
  function commitText() {
    const trimmed = draft.trim();
    const normalized = `${trimmed.startsWith('#') ? '' : '#'}${trimmed}`;
    if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(normalized);
    if (normalized.toLowerCase() !== value.toLowerCase()) onChange(normalized);
  }
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-x-2 min-[380px]:block">
      <label htmlFor={id} className="mb-0 block text-sm font-medium min-[380px]:mb-1.5">
        {label}
      </label>
      <div
        className={cn(
          'flex min-h-11 items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-primary/40',
          invalid ? 'border-destructive' : 'border-input'
        )}
      >
        <input
          ref={picker}
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(draft) ? draft : value}
          aria-label={t('pickColor', { name: label })}
          onInput={(event) => {
            setDraft(event.currentTarget.value);
            setInvalid(false);
          }}
          onChange={() => {}}
          className="h-11 w-11 shrink-0 cursor-pointer touch-manipulation rounded-l-md border-0 bg-transparent p-1.5 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait"
        />
        <input
          id={id}
          name={id}
          type="text"
          value={draft}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraft(value);
              setInvalid(false);
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              commitText();
            }
          }}
          className="min-h-11 w-full min-w-0 rounded-r-md bg-transparent pr-2 text-base uppercase text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        />
      </div>
      {invalid && (
        <p id={`${id}-error`} role="alert" className="col-span-2 mt-1 text-xs text-destructive">
          {t('invalidColor')}
        </p>
      )}
    </div>
  );
}

export function BoardDesignControls({
  styles,
  onChange,
}: {
  styles?: BoardStyleOptions | null;
  onChange: (patch: Partial<BoardDesignValues>) => void;
}) {
  const t = useTranslations('Themes.Builder');
  const id = useId();
  const search = useSearchParams();
  const open = search.get('design') === '1';
  const [values, setValues] = useState<BoardDesignValues | null>(null);
  useEffect(() => {
    setValues(editableBoardStyle(styles ?? {}));
  }, [styles]);
  function toggle() {
    if (!open) {
      openDesignControls();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('design');
    window.history.pushState(null, '', url);
  }
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className="flex min-h-12 w-full touch-manipulation items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="flex-1">{t('customize')}</span>
        <span className="flex -space-x-1" aria-hidden="true">
          {values &&
            colorKeys.map((key) => (
              <span
                key={key}
                style={{ backgroundColor: values[key] }}
                className="h-4 w-4 rounded-full border border-border ring-1 ring-background"
              />
            ))}
        </span>
        <ChevronDown aria-hidden="true" className={cn('ml-1 h-4 w-4', open && 'rotate-180')} />
      </button>
      <div id={id} hidden={!open} className="border-t border-border p-3">
        {values && (
          <>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:grid-cols-3">
              {colorKeys.map((key) => (
                <ColorControl
                  key={key}
                  label={t(key)}
                  value={values[key]}
                  onChange={(value) => onChange({ [key]: value })}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-medium">
                <span className="mb-1.5 block">{t('font')}</span>
                <span className="relative block">
                  <select
                    name="printFont"
                    value={values.font}
                    onChange={(event) =>
                      onChange({ font: event.target.value as BoardDesignValues['font'] })
                    }
                    className={selectClassName}
                  >
                    {printFonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                </span>
              </label>
              <label className="min-w-0 text-sm font-medium">
                <span className="mb-1.5 block">{t('borderStyle')}</span>
                <span className="relative block">
                  <select
                    name="borderStyle"
                    value={values.borderStyle}
                    onChange={(event) =>
                      onChange({
                        borderStyle: event.target.value as BoardDesignValues['borderStyle'],
                      })
                    }
                    className={selectClassName}
                  >
                    {borderStyles.map((border) => (
                      <option key={border} value={border}>
                        {t(`borders.${border}`)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                </span>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
