import samples from './samples.json';
import content from './content.json';
import { isThemeId, type ThemeId, type PhotoMode } from './presets';
export interface ThemeCopy {
  name: string;
  intro: string;
  ideas: string[];
  play: string;
}
export interface ThemePage {
  sample: {
    manifest: string;
    etsyListingId: string;
    assets: { board: string; photo: string; card: string };
  };
  published: boolean;
  id: ThemeId;
  updatedAt: string;
  en: ThemeCopy;
  'es-MX': ThemeCopy;
}
export const themePages: ThemePage[] = content
  .filter((page) => page.published)
  .map((page) => {
    if (!isThemeId(page.id)) throw new Error(`Landing page has no render preset: ${page.id}`);
    const sample = samples[page.id as keyof typeof samples];
    if (!sample) throw new Error(`Missing sample: ${page.id}`);
    return { ...page, id: page.id, sample, published: page.published };
  });
export function getThemePage(id: string) {
  return themePages.find((page) => page.id === id);
}
export function themeMode(id: string): PhotoMode {
  return id === 'original-photos' ? 'original' : 'illustrated';
}
export function themePath(id: string, locale = 'en') {
  return `${locale === 'es-MX' ? '/es' : ''}/loteria/${id}`;
}
export function themeTitle(page: ThemePage, locale: string) {
  if (page.id === 'original-photos')
    return locale === 'es-MX'
      ? 'Lotería personalizada con tus fotos originales'
      : 'Custom Lotería with Your Original Photos';
  return locale === 'es-MX'
    ? `Lotería personalizada · ${page['es-MX'].name}`
    : `Custom ${page.en.name} Lotería`;
}
