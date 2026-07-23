'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { MIN_EXPORT_BOARD_COUNT, MAX_EXPORT_BOARD_COUNT } from '@/lib/constants';
import { clampBoardCount } from '@/lib/generate-boards';

interface BoardCountStepperProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /**
   * Accessible name for the group and the input. Callers pass localized text
   * (consumer app) or plain English (admin surface); this component never
   * hardcodes user-facing copy.
   */
  label: string;
  /**
   * Accessible names for the −/+ buttons. Optional so a caller can omit them,
   * but both consumers pass explicit verbs — a screen reader announcing
   * "minus Number of boards" is a poor substitute for "Fewer boards".
   */
  decreaseLabel?: string;
  increaseLabel?: string;
  size?: 'sm' | 'default';
}

const SIZE_STYLES = {
  sm: {
    // ≥44px hit target on touch, ≥24px on pointer devices.
    button: 'h-11 w-11 md:h-8 md:w-8',
    input: 'h-11 w-12 md:h-8 text-base md:text-xs',
    icon: 'w-3.5 h-3.5',
  },
  default: {
    button: 'h-11 w-11 md:h-9 md:w-9',
    input: 'h-11 w-14 md:h-9 text-base md:text-sm',
    icon: 'w-4 h-4',
  },
} as const;

const BUTTON_BASE =
  'flex items-center justify-center bg-white text-muted-foreground transition-colors hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:relative focus-visible:z-10 touch-manipulation';

// Strip the native number spinners so only −/+ are offered.
const HIDE_SPINNERS =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0';

export function BoardCountStepper({
  value,
  onChange,
  disabled = false,
  label,
  decreaseLabel,
  increaseLabel,
  size = 'default',
}: BoardCountStepperProps) {
  const styles = SIZE_STYLES[size];

  // Raw text lets the user type freely (transient '' or '1e' is allowed);
  // it is only reconciled with the numeric value on blur/Enter.
  const [raw, setRaw] = useState(() => String(value));
  const rawRef = useRef(raw);

  const setRawText = useCallback((next: string) => {
    rawRef.current = next;
    setRaw(next);
  }, []);

  // Keep the displayed text in sync when `value` changes from outside.
  useEffect(() => {
    if (Number(rawRef.current) !== value) {
      rawRef.current = String(value);
      setRaw(String(value));
    }
  }, [value]);

  const commit = useCallback(() => {
    // Empty text means "nothing entered", not zero — hand clampBoardCount a NaN
    // so it resolves to the default rather than the minimum.
    const parsed = raw.trim() === '' ? NaN : Number(raw);
    const resolved = clampBoardCount(parsed);
    setRawText(String(resolved));
    if (resolved !== value) {
      onChange(resolved);
    }
  }, [raw, value, onChange, setRawText]);

  const step = (delta: number) => {
    const next = clampBoardCount(value + delta);
    setRawText(String(next));
    if (next !== value) {
      onChange(next);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setRawText(next);
    // Never block typing — only propagate once the text parses to a number.
    const parsed = Number(next);
    if (next.trim() !== '' && Number.isFinite(parsed)) {
      onChange(parsed);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commit();
    }
  };

  const atMin = value <= MIN_EXPORT_BOARD_COUNT;
  const atMax = value >= MAX_EXPORT_BOARD_COUNT;

  // shrink-0 on the root: in a tight flex row the stepper must never compress,
  // or the −/+ buttons fall below the minimum hit target.
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex shrink-0 items-center rounded-lg border border-border bg-white shadow-sm overflow-hidden"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || atMin}
        aria-label={decreaseLabel ?? `− ${label}`}
        className={`${BUTTON_BASE} ${styles.button} border-r border-border rounded-l-lg`}
      >
        <Minus className={styles.icon} aria-hidden="true" />
      </button>

      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={raw}
        onChange={handleInputChange}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        min={MIN_EXPORT_BOARD_COUNT}
        max={MAX_EXPORT_BOARD_COUNT}
        step={1}
        className={`${styles.input} ${HIDE_SPINNERS} bg-white text-center font-semibold text-foreground tabular-nums touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:opacity-40 disabled:cursor-not-allowed`}
      />

      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled || atMax}
        aria-label={increaseLabel ?? `+ ${label}`}
        className={`${BUTTON_BASE} ${styles.button} border-l border-border rounded-r-lg`}
      >
        <Plus className={styles.icon} aria-hidden="true" />
      </button>
    </div>
  );
}
