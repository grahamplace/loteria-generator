import type { PrintFont } from './presets';

/** One local font source for inline samples, canvas previews, and PDF exports. */
export const printFontFiles: Record<PrintFont, string> = {
  Jost: '/fonts/themes/Jost.woff2',
  Montserrat: '/fonts/themes/Montserrat-Regular.woff2',
  'Playfair Display': '/fonts/themes/PlayfairDisplay-Regular.woff2',
  Fredoka: '/fonts/themes/Fredoka-Regular.woff2',
  'Roboto Slab': '/fonts/themes/RobotoSlab-Regular.woff2',
  Caveat: '/fonts/themes/Caveat.woff2',
  'Bebas Neue': '/fonts/themes/BebasNeue-Regular.ttf',
  Creepster: '/fonts/themes/Creepster-Regular.ttf',
};

const loadedFonts = new Map<PrintFont, Promise<void>>();

export function loadPrintFont(family: PrintFont): Promise<void> {
  const existing = loadedFonts.get(family);
  if (existing) return existing;
  const promise = new FontFace(family, `url(${printFontFiles[family]})`)
    .load()
    .then((font) => {
      document.fonts.add(font);
    })
    .catch((error) => {
      loadedFonts.delete(family);
      throw error;
    });
  loadedFonts.set(family, promise);
  return promise;
}
