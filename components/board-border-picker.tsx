'use client';

import { useEffect, useId, useRef, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CurrentBorderStyle } from '@/lib/themes/presets';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/** A fixed wobble, so the hand-drawn sample doesn't change on every render. */
const handDrawnPath =
  'M3 3.4 L10 2.6 L17 3.5 L24 2.8 L31 3.3 L37 3 L36.6 9 L37.4 15 L36.7 21 L37 25 L30 25.5 L23 24.7 L16 25.4 L9 24.8 L3 25 L3.5 19 L2.7 13 L3.4 7 Z';

/** A small frame drawn in the board's colors, approximating the printed border. */
function BorderSwatch({
  border,
  color,
  background,
  large = false,
}: {
  border: CurrentBorderStyle;
  color: string;
  background: string;
  large?: boolean;
}) {
  const stroke = { fill: 'none', stroke: color };
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: background }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded border border-border',
        large ? 'h-11 w-14' : 'h-7 w-9'
      )}
    >
      {border !== 'none' && (
        <svg viewBox="0 0 40 28" className={large ? 'h-8 w-11' : 'h-5 w-7'}>
          {border === 'hand-drawn' && (
            <path d={handDrawnPath} {...stroke} strokeWidth={1.6} strokeLinejoin="round" />
          )}
          {(border === 'solid' || border === 'double') && (
            <rect x={3} y={3} width={34} height={22} {...stroke} strokeWidth={2} />
          )}
          {border === 'double' && (
            <rect x={7} y={7} width={26} height={14} {...stroke} strokeWidth={1} />
          )}
          {border === 'thick-thin' && (
            <>
              <rect x={3} y={3} width={34} height={22} {...stroke} strokeWidth={3.5} />
              <rect x={8.5} y={8.5} width={23} height={11} {...stroke} strokeWidth={1} />
            </>
          )}
          {border === 'dashed' && (
            <rect
              x={3}
              y={3}
              width={34}
              height={22}
              {...stroke}
              strokeWidth={2}
              strokeDasharray="5 3"
            />
          )}
          {border === 'dotted' && (
            <rect
              x={3}
              y={3}
              width={34}
              height={22}
              {...stroke}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeDasharray="0 5.6"
            />
          )}
        </svg>
      )}
    </span>
  );
}

export function BoardBorderPicker<Style extends CurrentBorderStyle>({
  label,
  options,
  value,
  color,
  background,
  disabled,
  onChange,
}: {
  label: string;
  options: readonly Style[];
  value: Style;
  color: string;
  background: string;
  disabled: boolean;
  onChange: (border: Style) => void;
}) {
  const t = useTranslations('Themes.Builder');
  const name = (border: CurrentBorderStyle): string => t(`borders.${border}`);
  const id = useId();
  const mobile = useIsMobile();
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Saving disables the controls, so Radix cannot return focus right after a
    // choice. Restore it when the save finishes, as the font picker does.
    if (!disabled && restoreFocus.current) {
      trigger.current?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [disabled]);

  return (
    <div className="min-w-0">
      <label id={`${id}-label`} htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <Select.Root
        value={value}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
        onValueChange={(border: Style) => onChange(border)}
      >
        <Select.Trigger
          ref={trigger}
          id={id}
          aria-labelledby={`${id}-label`}
          data-value={value}
          className="flex h-11 w-full min-w-0 touch-manipulation items-center gap-3 rounded-md border border-input bg-background px-2 py-1 text-left text-foreground hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
        >
          <BorderSwatch border={value} color={color} background={background} />
          <Select.Value asChild>
            <span className="min-w-0 flex-1 truncate text-sm">{name(value)}</span>
          </Select.Value>
          <Select.Icon asChild>
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position={mobile ? 'item-aligned' : 'popper'}
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onCloseAutoFocus={(event) => {
              if (trigger.current?.matches(':disabled')) {
                event.preventDefault();
                restoreFocus.current = true;
              }
            }}
            className="z-50 max-h-[min(32rem,var(--radix-select-content-available-height,calc(100dvh-2rem)))] w-[min(20rem,calc(100vw-2rem))] min-w-0 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg md:w-[var(--radix-select-trigger-width)]"
          >
            <Select.ScrollUpButton
              className="flex h-6 items-center justify-center text-primary"
              aria-hidden="true"
            >
              <ChevronUp className="h-4 w-4" />
            </Select.ScrollUpButton>
            <Select.Viewport className="overscroll-contain p-1">
              {options.map((border) => (
                <Select.Item
                  key={border}
                  value={border}
                  textValue={name(border)}
                  disabled={disabled}
                  className="relative flex min-h-14 w-full min-w-0 cursor-pointer touch-manipulation select-none items-center gap-3 rounded-md px-2 py-1.5 pr-9 outline-none data-[state=checked]:bg-primary/5 data-[highlighted]:bg-primary/10 data-[highlighted]:ring-2 data-[highlighted]:ring-inset data-[highlighted]:ring-primary"
                >
                  <BorderSwatch border={border} color={color} background={background} large />
                  <Select.ItemText>
                    <span className="block truncate text-sm">{name(border)}</span>
                  </Select.ItemText>
                  <Select.ItemIndicator className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                    <Check aria-hidden="true" className="h-4 w-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton
              className="flex h-6 items-center justify-center text-primary"
              aria-hidden="true"
            >
              <ChevronDown className="h-4 w-4" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
