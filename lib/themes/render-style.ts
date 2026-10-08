import { getTheme, type BoardStyleOptions } from './presets';

export function printColor(token: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!value) throw new Error(`Missing print color: ${token}`);
  return value;
}

export function resolveBoardStyle(options: BoardStyleOptions = {}) {
  const preset = getTheme(options.presetId);
  const color = (key: string) => printColor(`--loteria-${preset.id}-${key}`);
  const legacy = !options.presetId;
  return {
    backgroundColor: (legacy && options.backgroundColor) || color('paper'),
    badgeColor: (legacy && options.badgeColor) || color('badge'),
    labelColor: (legacy && options.labelColor) || color('ink'),
    borderColor: color('accent'),
    numberColor: preset.id === 'classic' ? printColor('--loteria-number-ink') : color('number'),
    font: preset.font,
    frame: preset.frame,
    themed: preset.id !== 'classic',
  };
}
export type ResolvedBoardStyle = ReturnType<typeof resolveBoardStyle>;

const loadedFonts = new Map<string, Promise<void>>();
export async function loadPrintFonts(displayFont = 'Jost') {
  const paths: Record<string, string> = {
    Caveat: '/fonts/themes/Caveat.woff2',
    Jost: '/fonts/themes/Jost.woff2',
    Creepster: '/fonts/themes/Creepster-Regular.ttf',
    'Bebas Neue': '/fonts/themes/BebasNeue-Regular.ttf',
  };
  await Promise.all(
    [...new Set(['Caveat', 'Jost', displayFont])].map((family) => {
      if (!loadedFonts.has(family)) {
        const promise = new FontFace(family, `url(${paths[family]})`)
          .load()
          .then((font) => {
            document.fonts.add(font);
          })
          .catch((error) => {
            loadedFonts.delete(family);
            throw error;
          });
        loadedFonts.set(family, promise);
      }
      return loadedFonts.get(family);
    })
  );
}

/** Decorations stay inside the printable edge and outside the card grid. */
export function drawThemeFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: ResolvedBoardStyle
) {
  if (!style.themed) return;
  ctx.save();
  ctx.strokeStyle = style.borderColor;
  ctx.fillStyle = style.borderColor;
  ctx.lineWidth = 5;
  const margin = 80;
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
  ctx.lineWidth = 2;
  ctx.strokeRect(margin + 15, margin + 15, width - (margin + 15) * 2, height - (margin + 15) * 2);
  for (const [cx, cy, angle] of [
    [120, 120, 0],
    [width - 120, 120, Math.PI / 2],
    [width - 120, height - 120, Math.PI],
    [120, height - 120, -Math.PI / 2],
  ]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    if (style.frame === 'web') {
      for (let i = 0; i <= 4; i++) {
        const a = (i * Math.PI) / 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 145, Math.sin(a) * 145);
        ctx.stroke();
      }
      for (const radius of [40, 80, 120]) {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI / 2);
        ctx.stroke();
      }
    } else if (style.frame === 'floral' || style.frame === 'leaves') {
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 4);
        ctx.beginPath();
        ctx.ellipse(32, 0, 25, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if (style.frame === 'waves') {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(30, 30, 15 + i * 18, 0, Math.PI);
        ctx.stroke();
      }
    } else if (style.frame === 'papel') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(120, 0);
      ctx.lineTo(100, 55);
      ctx.lineTo(60, 35);
      ctx.lineTo(20, 55);
      ctx.closePath();
      ctx.stroke();
    } else if (style.frame === 'sport') {
      ctx.beginPath();
      ctx.arc(25, 25, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(10, 10, 30, 30);
    } else if (style.frame === 'pencils') {
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(0, -8, 90, 16);
      ctx.beginPath();
      ctx.moveTo(90, -8);
      ctx.lineTo(108, 0);
      ctx.lineTo(90, 8);
      ctx.stroke();
    } else if (style.frame !== 'none') {
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(i * 23, (i % 2) * 18);
        ctx.rotate(i * 0.4);
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
