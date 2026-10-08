'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronRight, Loader2 } from 'lucide-react';
import { themePresets, type ThemeId } from '@/lib/themes/presets';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function setPickerOpen(open: boolean) {
  const url = new URL(window.location.href);
  if (open) {
    url.searchParams.set('themePicker', '1');
    window.history.pushState(null, '', url);
  } else {
    url.searchParams.delete('themePicker');
    window.history.replaceState(null, '', url);
  }
}

function ThemeThumbnail({ id, selected = false }: { id: ThemeId; selected?: boolean }) {
  return (
    <span className="relative w-8 shrink-0">
      <Image
        src={`/themes/picker/${id}.webp`}
        width={32}
        height={42}
        alt=""
        unoptimized
        className="h-auto w-full rounded-sm border border-foreground/10 shadow-sm"
      />
      {selected && (
        <span
          aria-hidden="true"
          className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
    </span>
  );
}

const tileClassName =
  'relative flex min-h-16 min-w-0 touch-manipulation items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors';

export function BoardThemePicker({
  selected,
  saving,
  error,
  onSelect,
}: {
  selected: ThemeId;
  saving: boolean;
  error: string;
  onSelect: (id: ThemeId) => Promise<boolean>;
}) {
  const t = useTranslations('Themes.Builder');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  const groupName = useId();
  const searchParams = useSearchParams();
  const open = searchParams.get('themePicker') === '1';
  const selectedButton = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<ThemeId | null>(null);
  const current = themePresets.find((preset) => preset.id === selected) ?? themePresets[0];

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setPickerOpen(false);
    };
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [open]);

  async function selectMobile(id: ThemeId) {
    if (saving || pending) return;
    if (id === selected) {
      setPickerOpen(false);
      return;
    }
    setPending(id);
    try {
      if (await onSelect(id)) setPickerOpen(false);
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setPickerOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              disabled={saving}
              aria-label={t('changeTheme', { name: current.name[locale] })}
              className="flex min-h-16 w-full min-w-0 touch-manipulation items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
            >
              <ThemeThumbnail id={current.id} />
              <span className="min-w-0 flex-1 break-words text-sm font-medium">
                {current.name[locale]}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                {t('change')}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            aria-describedby={undefined}
            closeLabel={t('closeThemePicker')}
            className="max-h-[85dvh] gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)] motion-reduce:animate-none"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              selectedButton.current?.focus();
            }}
          >
            <SheetHeader className="shrink-0 pr-16">
              <SheetTitle>{t('chooseTheme')}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
              <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3">
                {themePresets.map((preset) => (
                  <button
                    key={preset.id}
                    ref={selected === preset.id ? selectedButton : undefined}
                    type="button"
                    aria-pressed={selected === preset.id}
                    disabled={saving || pending !== null}
                    onClick={() => void selectMobile(preset.id)}
                    className={cn(
                      tileClassName,
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60',
                      selected === preset.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-background/60 hover:border-primary/50 hover:bg-background'
                    )}
                  >
                    <ThemeThumbnail id={preset.id} selected={selected === preset.id} />
                    <span className="min-w-0 flex-1 break-words text-[0.8125rem] font-medium leading-tight text-foreground sm:text-sm">
                      {preset.name[locale]}
                    </span>
                    {pending === preset.id && (
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
            {(saving || error) && (
              <div className="shrink-0 border-t border-border px-4 py-3 text-sm">
                {saving && <p role="status">{t('saving')}</p>}
                {error && (
                  <p role="alert" className="text-destructive">
                    {error}
                  </p>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
      <div
        role="radiogroup"
        aria-label={t('chooseTheme')}
        className="hidden gap-2 lg:grid lg:grid-cols-3 xl:grid-cols-4"
      >
        {themePresets.map((preset) => (
          <label
            key={preset.id}
            className={cn(
              tileClassName,
              'min-h-14 cursor-pointer px-2 py-1.5 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60',
              selected === preset.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border bg-background/60 hover:border-primary/50 hover:bg-background'
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={preset.id}
              checked={selected === preset.id}
              disabled={saving}
              onChange={() => void onSelect(preset.id)}
              className="peer sr-only"
            />
            <span className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary" />
            <ThemeThumbnail id={preset.id} selected={selected === preset.id} />
            <span className="min-w-0 flex-1 break-words text-sm font-medium leading-tight text-foreground">
              {preset.name[locale]}
            </span>
          </label>
        ))}
      </div>
    </>
  );
}
