'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  boardFrameStyles,
  borderStyles,
  type BoardDesignValues,
  type BoardStyleOptions,
  type BorderStyle,
  type CurrentBorderStyle,
} from '@/lib/themes/presets';
import { editableBoardStyle } from '@/lib/themes/render-style';
import { cn } from '@/lib/utils';
import { BoardCornerPicker } from '@/components/board-corner-picker';
import { BoardFontPicker } from '@/components/board-font-picker';

const colorKeys = [
  'backgroundColor',
  'labelColor',
  'borderColor',
  'cardColor',
  'cardTextColor',
  'badgeColor',
  'numberColor',
] as const;

function ColorControl({
  label,
  value,
  layout,
  onLive,
  onChange,
}: {
  label: string;
  value: string;
  layout: DesignLayout;
  /** Every valid in-progress color, for an immediate preview. */
  onLive: (value: string) => void;
  /** A finished choice: picker closed, Enter, or blur. */
  onChange: (value: string) => void;
}) {
  const id = useId();
  const t = useTranslations('Themes.Builder');
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const openingPicker = useRef(false);
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
  function openPicker() {
    const input = picker.current;
    if (!input || input.matches(':disabled') || openingPicker.current) return;
    // A successful showPicker consumes activation. Don't reopen the chooser
    // when the click follows the same focus event, or when focus is restored.
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    openingPicker.current = true;
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
    } catch {
      // Browsers can refuse focus-triggered pickers; the native swatch remains
      // clickable and direct hex entry still works.
    } finally {
      openingPicker.current = false;
    }
  }
  function commitText() {
    const trimmed = draft.trim();
    const normalized = `${trimmed.startsWith('#') ? '' : '#'}${trimmed}`;
    if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(normalized);
    // The live preview may already show this color; committing still saves it now.
    onChange(normalized.toLowerCase());
  }
  const row = layout === 'sheet';
  return (
    // Escape in these fields reverts the color (or closes the OS chooser), not the dialog.
    <div data-color-control className="group/color min-w-0">
      <div
        className={cn(
          'flex items-center rounded-lg border bg-background',
          row ? 'min-h-12 gap-3 pr-3 pl-2' : 'min-h-11 gap-2.5 pr-2.5 pl-1.5',
          invalid ? 'border-destructive' : 'border-input'
        )}
      >
        <input
          ref={picker}
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(draft) ? draft : value}
          aria-label={t('pickColor', { name: label })}
          onFocus={openPicker}
          onClick={(event) => {
            if (typeof event.currentTarget.showPicker === 'function') {
              event.preventDefault();
              openPicker();
            }
          }}
          onInput={(event) => {
            setDraft(event.currentTarget.value);
            setInvalid(false);
            onLive(event.currentTarget.value);
          }}
          onChange={() => {}}
          className="size-10 shrink-0 cursor-pointer touch-manipulation rounded-md border-0 bg-transparent p-1 outline-none focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait"
        />
        <span className={cn('flex min-w-0 flex-1', row ? 'items-center gap-2' : 'flex-col')}>
          <label
            htmlFor={id}
            className={cn(
              'min-w-0 font-semibold decoration-primary underline-offset-4 group-has-[:focus-visible]/color:underline',
              row ? 'flex-1 text-sm' : 'truncate text-xs'
            )}
          >
            {label}
          </label>
          <input
            id={id}
            name={id}
            type="text"
            value={draft}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onFocus={openPicker}
            onClick={openPicker}
            onChange={(event) => {
              setDraft(event.target.value);
              setInvalid(false);
              const typed = event.target.value.trim();
              const normalized = `${typed.startsWith('#') ? '' : '#'}${typed}`;
              if (/^#[0-9a-f]{6}$/i.test(normalized)) onLive(normalized.toLowerCase());
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
            className={cn(
              'min-w-0 touch-manipulation bg-transparent font-mono text-muted-foreground uppercase outline-none',
              // 16px on phones so iOS does not zoom into the field.
              row ? 'h-11 w-[5.5rem] text-right text-base' : 'h-5 w-full text-xs'
            )}
          />
        </span>
      </div>
      {invalid && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-destructive">
          {t('invalidColor')}
        </p>
      )}
    </div>
  );
}

export type DesignLayout = 'dialog' | 'sheet';

/** The four colors shown in the Customize header, in print order. */
const swatchKeys = ['backgroundColor', 'badgeColor', 'labelColor', 'borderColor'] as const;

/**
 * The design's four main colors as small chips. `small` suits the Theme row's
 * label line. Resolved after mount: print colors come from CSS.
 */
export function DesignSwatches({
  styles,
  small = false,
}: {
  styles?: BoardStyleOptions | null;
  small?: boolean;
}) {
  const [values, setValues] = useState<BoardDesignValues | null>(null);
  useEffect(() => {
    setValues(editableBoardStyle(styles ?? {}));
  }, [styles]);
  return (
    <span className="flex shrink-0 gap-0.5" aria-hidden="true">
      {values &&
        swatchKeys.map((key) => (
          <span
            key={key}
            style={{ backgroundColor: values[key] }}
            className={cn(
              'rounded-full border border-foreground/15',
              small ? 'size-3' : 'size-3.5'
            )}
          />
        ))}
    </span>
  );
}

export function BoardDesignControls({
  styles,
  boardName,
  disabled,
  open,
  layout,
  onOpenChange,
  onPreview,
  onChange,
}: {
  styles?: BoardStyleOptions | null;
  boardName: string;
  disabled: boolean;
  open: boolean;
  layout: DesignLayout;
  onOpenChange: (open: boolean) => void;
  /** Show an in-progress edit right away; saved shortly after it settles. */
  onPreview: (patch: Partial<BoardDesignValues>) => void;
  onChange: (patch: Partial<BoardDesignValues>) => void;
}) {
  const t = useTranslations('Themes.Builder');
  const id = useId();
  const [values, setValues] = useState<BoardDesignValues | null>(null);
  useEffect(() => {
    setValues(editableBoardStyle(styles ?? {}));
  }, [styles]);
  const row = layout === 'sheet';
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpenChange(!open)}
        className={cn(
          'flex w-full touch-manipulation items-center gap-2.5 rounded-xl px-3.5 text-left hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          row ? 'min-h-13' : 'min-h-12'
        )}
      >
        <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm font-semibold">{t('customizeColorsFont')}</span>
        <DesignSwatches styles={styles} />
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 transition-transform motion-reduce:transition-none',
            open && 'rotate-180'
          )}
        />
      </button>
      <div id={id} hidden={!open} className="space-y-4 border-t border-border px-3.5 pt-3 pb-4">
        {values && (
          <>
            <div
              className={cn(
                'grid gap-2.5',
                row ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]'
              )}
            >
              {colorKeys.map((key) => (
                <ColorControl
                  key={key}
                  label={t(key)}
                  value={values[key]}
                  layout={layout}
                  onLive={(value) => onPreview({ [key]: value })}
                  onChange={(value) => onChange({ [key]: value })}
                />
              ))}
            </div>
            <div className={cn('grid gap-3', row ? 'grid-cols-1' : 'grid-cols-2')}>
              <BoardFontPicker
                value={values.font}
                boardName={boardName}
                active={open}
                disabled={disabled}
                onChange={(font) => onChange({ font })}
              />
              <BoardCornerPicker
                value={values.cornerIcon}
                color={values.borderColor}
                background={values.backgroundColor}
                disabled={disabled}
                onChange={(cornerIcon) => onChange({ cornerIcon })}
              />
            </div>
            <BorderStylePicker
              legend={t('boardBorder')}
              options={boardFrameStyles}
              value={values.borderStyle === 'hand-drawn' ? 'none' : values.borderStyle}
              disabled={disabled}
              onChange={(borderStyle) => onChange({ borderStyle })}
            />
            <BorderStylePicker
              legend={t('cardBorder')}
              options={borderStyles}
              value={values.cardBorderStyle}
              disabled={disabled}
              onChange={(cardBorderStyle) => onChange({ cardBorderStyle })}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Segmented control backed by native radios, so arrow keys move the choice. */
function BorderStylePicker<Style extends CurrentBorderStyle>({
  legend,
  options,
  value,
  disabled,
  onChange,
}: {
  legend: string;
  options: readonly Style[];
  value: BorderStyle;
  disabled: boolean;
  onChange: (value: Style) => void;
}) {
  const t = useTranslations('Themes.Builder');
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      {/* Wrapped rows stretch to full width, so a short last row leaves no gaps. */}
      <div className="flex flex-wrap gap-px overflow-hidden rounded-lg border border-input bg-input">
        {options.map((border) => (
          <label
            key={border}
            className="relative flex min-h-11 grow basis-[30%] min-[420px]:basis-[22%] cursor-pointer touch-manipulation items-center justify-center bg-background px-1.5 text-center text-[0.8125rem] leading-tight font-medium text-foreground transition-colors hover:bg-primary/5 has-[:checked]:bg-primary has-[:checked]:font-semibold has-[:checked]:text-primary-foreground has-[:disabled]:cursor-wait has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-4 has-[:focus-visible]:outline-current motion-reduce:transition-none"
          >
            <input
              type="radio"
              name={name}
              value={border}
              checked={value === border}
              disabled={disabled}
              onChange={() => onChange(border)}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0 disabled:cursor-wait"
            />
            {t(`borders.${border as CurrentBorderStyle}`)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
