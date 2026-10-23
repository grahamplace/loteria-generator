import { isThemeId, type PhotoMode } from '@/lib/themes/presets';
export function parseThemeEntry(theme: unknown, mode: unknown) {
  if (!isThemeId(theme)) return null;
  const photoMode: PhotoMode = mode === 'original' ? 'original' : 'illustrated';
  return { theme, photoMode };
}
export function themeStartPath(theme: string, mode: PhotoMode, locale: string) {
  return `${locale === 'es-MX' ? '/es' : ''}/start?theme=${encodeURIComponent(theme)}&mode=${mode}`;
}
