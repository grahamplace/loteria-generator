'use client';

import { useEffect, useId, useRef, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { printFonts, type PrintFont } from '@/lib/themes/presets';
import { loadPrintFont } from '@/lib/themes/fonts';
import { useIsMobile } from '@/hooks/use-mobile';

type FontStatus = 'ready' | 'error';

export function BoardFontPicker({
  value,
  boardName,
  active,
  disabled,
  onChange,
}: {
  value: PrintFont;
  boardName: string;
  active: boolean;
  disabled: boolean;
  onChange: (font: PrintFont) => void;
}) {
  const t = useTranslations('Themes.Builder');
  const id = useId();
  const mobile = useIsMobile();
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Partial<Record<PrintFont, FontStatus>>>({});
  const [retry, setRetry] = useState(0);
  const title = (boardName.trim().replace(/\s+/g, ' ') || t('fontSampleTitle')).toUpperCase();
  const hasError = Object.values(status).includes('error');

  useEffect(() => {
    // Saving disables the surrounding fieldset, so Radix cannot return focus
    // immediately after choosing a font. Restore it when the save finishes.
    if (!disabled && restoreFocus.current) {
      trigger.current?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [disabled]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    // Only the selected face is needed until the user opens the menu. The
    // renderer shares these promises, so concurrent previews never refetch.
    const families = open ? printFonts : [value];
    for (const family of families) {
      loadPrintFont(family).then(
        () => {
          if (!cancelled) setStatus((previous) => ({ ...previous, [family]: 'ready' }));
        },
        () => {
          if (!cancelled) setStatus((previous) => ({ ...previous, [family]: 'error' }));
        }
      );
    }
    return () => {
      cancelled = true;
    };
  }, [active, open, value, retry]);

  function sample(font: PrintFont, compact = false) {
    return status[font] === 'ready' ? (
      <span
        aria-hidden="true"
        title={title}
        style={{ fontFamily: `'${font}', sans-serif` }}
        className={
          compact
            ? 'min-w-0 flex-1 truncate text-xl font-normal leading-6'
            : 'block truncate text-[22px] font-normal leading-8'
        }
      >
        {title}
      </span>
    ) : (
      <span
        aria-hidden="true"
        className={`flex min-w-0 items-center gap-2 text-xs text-muted-foreground ${compact ? 'h-6 flex-1' : 'h-8'}`}
      >
        {status[font] === 'error' ? (
          <span className="truncate">{t('fontPreviewError')}</span>
        ) : (
          <>
            <Loader2 className="h-3 w-3 shrink-0 animate-spin motion-reduce:animate-none" />
            <span className="truncate">{t('fontLoading')}</span>
          </>
        )}
      </span>
    );
  }

  return (
    <div className="min-w-0">
      <label id={`${id}-label`} htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {t('font')}
      </label>
      <Select.Root
        value={value}
        open={open && active}
        onOpenChange={setOpen}
        disabled={disabled}
        onValueChange={(font: PrintFont) => onChange(font)}
      >
        <Select.Trigger
          ref={trigger}
          id={id}
          aria-labelledby={`${id}-label`}
          data-value={value}
          className="flex h-11 w-full min-w-0 touch-manipulation items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-left text-foreground hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <Select.Value asChild>
              <span className="max-w-[45%] shrink-0 truncate text-sm text-muted-foreground">
                {value}
              </span>
            </Select.Value>
            {sample(value, true)}
          </span>
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
              {printFonts.map((font) => (
                <Select.Item
                  key={font}
                  value={font}
                  textValue={font}
                  aria-label={font}
                  disabled={disabled || status[font] !== 'ready'}
                  className="relative min-h-[72px] w-full min-w-0 cursor-pointer touch-manipulation select-none rounded-md px-3 py-2 pr-9 outline-none data-[state=checked]:bg-primary/5 data-[highlighted]:bg-primary/10 data-[highlighted]:ring-2 data-[highlighted]:ring-inset data-[highlighted]:ring-primary data-[disabled]:cursor-wait"
                >
                  <Select.ItemText>
                    <span className="block truncate text-xs text-muted-foreground">{font}</span>
                  </Select.ItemText>
                  {sample(font)}
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
      {hasError && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
          <span role="status" className="text-muted-foreground">
            {t('fontPreviewError')}
          </span>
          <button
            type="button"
            onClick={() => {
              setStatus({});
              setRetry((count) => count + 1);
              setOpen(true);
            }}
            className="min-h-11 touch-manipulation rounded px-1 text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {t('retryPreview')}
          </button>
        </div>
      )}
    </div>
  );
}
