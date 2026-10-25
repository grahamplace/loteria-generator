'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Loader2, SlidersHorizontal } from 'lucide-react';
import { themePresets, type BoardThemeId } from '@/lib/themes/presets';
import { cn } from '@/lib/utils';

/** Localized display name for a preset or the board's custom design. */
export function useThemeName() {
  const t = useTranslations('Themes.Builder');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  return (id: BoardThemeId) =>
    id === 'custom' ? t('custom') : (themePresets.find((p) => p.id === id)?.name[locale] ?? id);
}

/**
 * A crop of the theme's sample board (title and first rows), or the custom
 * icon. Sized by its container.
 */
export function ThemeThumbnail({ id, className }: { id: BoardThemeId; className?: string }) {
  if (id === 'custom') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/20 bg-primary/5 text-primary',
          className
        )}
      >
        <SlidersHorizontal className="size-5" />
      </span>
    );
  }
  return (
    <Image
      src={`/themes/picker/${id}.webp`}
      width={96}
      height={124}
      alt=""
      unoptimized
      className={cn(
        'shrink-0 rounded-md border border-foreground/10 object-cover object-top shadow-sm',
        className
      )}
    />
  );
}

function SelectedCheck({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground',
        className
      )}
    >
      <Check className="size-3" strokeWidth={3.5} />
    </span>
  );
}

/**
 * Every preset plus Custom. `grid` is the roomy desktop dialog layout;
 * `list` is the two-column phone layout with the thumbnail beside the name.
 */
export function BoardThemeGrid({
  selected,
  pending,
  layout,
  onSelect,
}: {
  selected: BoardThemeId;
  pending: BoardThemeId | null;
  layout: 'grid' | 'list';
  onSelect: (id: BoardThemeId) => void;
}) {
  const t = useTranslations('Themes.Builder');
  const themeName = useThemeName();
  const choices: BoardThemeId[] = [...themePresets.map((preset) => preset.id), 'custom'];

  return (
    <div
      role="group"
      aria-label={t('chooseTheme')}
      className={cn(
        'grid gap-2.5',
        layout === 'grid' ? 'grid-cols-3 @xl:grid-cols-4' : 'grid-cols-2'
      )}
    >
      {choices.map((id) => {
        const isSelected = selected === id;
        const tileState = isSelected
          ? 'border-primary ring-3 ring-primary/20'
          : 'border-border hover:border-primary/50';
        const status =
          pending === id ? (
            <Loader2
              className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : isSelected ? (
            <SelectedCheck className={layout === 'grid' ? 'size-4' : 'size-[18px]'} />
          ) : null;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(id)}
            className={cn(
              'min-w-0 touch-manipulation rounded-xl border-2 bg-card text-left text-foreground transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none',
              tileState,
              layout === 'grid'
                ? 'flex flex-col gap-2 p-1.5 pb-2'
                : 'flex min-h-14 items-center gap-2.5 p-1.5'
            )}
          >
            {layout === 'grid' ? (
              <>
                <ThemeThumbnail id={id} className="aspect-[5/4] h-auto w-full" />
                <span className="flex min-w-0 items-center justify-between gap-1.5 px-0.5">
                  <span className="min-w-0 truncate text-xs font-semibold">{themeName(id)}</span>
                  {status}
                </span>
              </>
            ) : (
              <>
                <ThemeThumbnail id={id} className="h-[42px] w-[52px]" />
                <span className="min-w-0 flex-1 text-[0.8125rem] leading-tight font-semibold break-words">
                  {themeName(id)}
                </span>
                {status}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
