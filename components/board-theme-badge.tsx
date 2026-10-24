import type { CSSProperties } from 'react';
import {
  boardThemeVariables,
  getTheme,
  selectedBoardTheme,
  type BoardStyleOptions,
} from '@/lib/themes/presets';

/** Shared presentation; the admin list does not require an intl provider. */
export function BoardThemeBadge({
  styles,
  locale = 'en',
  customLabel = 'Custom',
  themeLabel = 'Theme',
}: {
  styles?: BoardStyleOptions | null;
  locale?: 'en' | 'es-MX';
  customLabel?: string;
  themeLabel?: string;
}) {
  const selected = selectedBoardTheme(styles);
  const name = selected === 'custom' ? customLabel : getTheme(selected).name[locale];
  return (
    <span
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground"
      style={boardThemeVariables(styles) as CSSProperties}
    >
      <span
        aria-hidden="true"
        className="flex shrink-0 overflow-hidden rounded-full border border-foreground/15"
      >
        <span className="size-3 bg-[var(--theme-paper)]" />
        <span className="size-3 bg-[var(--theme-accent)]" />
        <span className="size-3 bg-[var(--theme-badge)]" />
      </span>
      <span className="min-w-0 break-words">
        <span className="sr-only">{themeLabel}: </span>
        {name}
      </span>
    </span>
  );
}
