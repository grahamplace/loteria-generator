'use client';

import { useEffect, useId, useRef, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  cornerIconDefinitions,
  cornerIcons,
  type CornerIcon,
  type CornerIconDefinition,
} from '@/lib/themes/corner-icons';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/** The icon as printed in the top-left corner, in the board's own colors. */
function CornerSwatch({
  icon,
  color,
  background,
  large = false,
}: {
  icon: CornerIcon;
  color: string;
  background: string;
  large?: boolean;
}) {
  const definition: CornerIconDefinition | null =
    icon === 'none' ? null : cornerIconDefinitions[icon];
  const box = definition?.viewBox ?? 100;
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: background }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded border border-border',
        large ? 'h-11 w-11' : 'h-7 w-7'
      )}
    >
      {definition ? (
        <svg viewBox={`0 0 ${box} ${box}`} className={large ? 'h-8 w-8' : 'h-5 w-5'}>
          <path
            d={definition.path}
            fill={definition.paint === 'fill' ? color : 'none'}
            fillRule={definition.fillRule}
            stroke={definition.paint === 'fill' ? 'none' : color}
            strokeWidth={definition.paint === 'fill' ? undefined : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

export function BoardCornerPicker({
  value,
  color,
  background,
  disabled,
  onChange,
}: {
  value: CornerIcon;
  color: string;
  background: string;
  disabled: boolean;
  onChange: (icon: CornerIcon) => void;
}) {
  const t = useTranslations('Themes.Builder');
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
        {t('cornerIcon')}
      </label>
      <Select.Root
        value={value}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
        onValueChange={(icon: CornerIcon) => onChange(icon)}
      >
        <Select.Trigger
          ref={trigger}
          id={id}
          aria-labelledby={`${id}-label`}
          data-value={value}
          className="flex h-11 w-full min-w-0 touch-manipulation items-center gap-3 rounded-md border border-input bg-background px-2 py-1 text-left text-foreground hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
        >
          <CornerSwatch icon={value} color={color} background={background} />
          <Select.Value asChild>
            <span className="min-w-0 flex-1 truncate text-sm">{t(`corners.${value}`)}</span>
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
              {cornerIcons.map((icon) => (
                <Select.Item
                  key={icon}
                  value={icon}
                  textValue={t(`corners.${icon}`)}
                  disabled={disabled}
                  className="relative flex min-h-14 w-full min-w-0 cursor-pointer touch-manipulation select-none items-center gap-3 rounded-md px-2 py-1.5 pr-9 outline-none data-[state=checked]:bg-primary/5 data-[highlighted]:bg-primary/10 data-[highlighted]:ring-2 data-[highlighted]:ring-inset data-[highlighted]:ring-primary"
                >
                  <CornerSwatch icon={icon} color={color} background={background} large />
                  <Select.ItemText>
                    <span className="block truncate text-sm">{t(`corners.${icon}`)}</span>
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
