import { readFileSync } from 'node:fs';

/** Load real print tokens without asking jsdom to parse Tailwind's stylesheet. */
export function installPrintPalettes() {
  const css = readFileSync('app/globals.css', 'utf8');
  for (const [, token, value] of css.matchAll(/(--loteria-[\w-]+):\s*([^;]+);/g)) {
    document.documentElement.style.setProperty(token, value.trim());
  }
}
