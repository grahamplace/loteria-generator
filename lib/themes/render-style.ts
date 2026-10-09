import {
  getTheme,
  boardBorderStyle,
  type BoardStyleOptions,
  type BoardDesignValues,
  type ThemeId,
  type FrameStyle,
  type PrintFont,
} from './presets';
import { loadPrintFont } from './fonts';

export function printColor(token: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!value) throw new Error(`Missing print color: ${token}`);
  // CSS optimization shortens hex values; native color inputs and persisted
  // settings use six digits, so expand the browser's resolved token here.
  return /^#[0-9a-f]{3}$/i.test(value)
    ? `#${value
        .slice(1)
        .split('')
        .map((digit) => digit + digit)
        .join('')}`
    : value;
}

/** Concrete values are saved when a preset is picked, so Custom never depends on a theme ID. */
export function presetBoardStyle(id: ThemeId): BoardDesignValues {
  const preset = getTheme(id);
  const color = (key: string) => printColor(`--loteria-${id}-${key}`);
  return {
    backgroundColor: color('paper'),
    badgeColor: color('badge'),
    labelColor: color('ink'),
    borderColor: color('accent'),
    numberColor: id === 'classic' ? printColor('--loteria-number-ink') : color('number'),
    font: preset.font,
    borderStyle: boardBorderStyle({ presetId: id }),
  };
}

export function resolveBoardStyle(options: BoardStyleOptions = {}) {
  const defaults = presetBoardStyle(getTheme(options.presetId).id);
  const design: BoardDesignValues = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof BoardDesignValues)[]) {
    // Assign only defined fields; legacy boards may contain partial color settings.
    if (options[key] !== undefined) Object.assign(design, { [key]: options[key] });
  }
  // Resolve retired decorations on read so existing boards and Custom history
  // match the current picker and exports without rewriting saved designs.
  design.borderStyle = boardBorderStyle(options);
  return {
    ...design,
    // Existing boards retain their typography until a design is explicitly saved.
    labelFont: options.font ?? 'Jost',
    numberFont: options.font ?? 'Caveat',
    frame: (design.borderStyle === 'web' || design.borderStyle === 'pencils'
      ? design.borderStyle
      : 'none') satisfies FrameStyle,
    themed: design.borderStyle !== 'hand-drawn' && design.borderStyle !== 'none',
  };
}

export function editableBoardStyle(options: BoardStyleOptions = {}): BoardDesignValues {
  const { backgroundColor, badgeColor, labelColor, borderColor, numberColor, font, borderStyle } =
    resolveBoardStyle(options);
  return { backgroundColor, badgeColor, labelColor, borderColor, numberColor, font, borderStyle };
}
export type ResolvedBoardStyle = ReturnType<typeof resolveBoardStyle>;

export async function loadPrintFonts(displayFont: PrintFont = 'Jost') {
  await Promise.all([...new Set<PrintFont>(['Caveat', 'Jost', displayFont])].map(loadPrintFont));
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
  if (style.borderStyle === 'dashed') ctx.setLineDash([24, 18]);
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
  ctx.setLineDash([]);
  if (style.borderStyle !== 'solid' && style.borderStyle !== 'dashed') {
    ctx.lineWidth = 2;
    ctx.strokeRect(margin + 15, margin + 15, width - (margin + 15) * 2, height - (margin + 15) * 2);
  }
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
    } else if (style.frame === 'pencils') {
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(0, -8, 90, 16);
      ctx.beginPath();
      ctx.moveTo(90, -8);
      ctx.lineTo(108, 0);
      ctx.lineTo(90, 8);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
