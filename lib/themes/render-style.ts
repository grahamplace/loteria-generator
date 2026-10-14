import {
  getTheme,
  boardBorderStyle,
  boardCornerIcon,
  type BoardStyleOptions,
  type BoardDesignValues,
  type ThemeId,
  type PrintFont,
} from './presets';
import { cornerIconDefinitions } from './corner-icons';
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
    cornerIcon: boardCornerIcon({ presetId: id }),
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
  design.cornerIcon = boardCornerIcon(options);
  const themed = design.borderStyle !== 'hand-drawn' && design.borderStyle !== 'none';
  return {
    ...design,
    // Existing boards retain their typography until a design is explicitly saved.
    labelFont: options.font ?? 'Jost',
    numberFont: options.font ?? 'Caveat',
    themed,
    /** Inset the card grid when a frame or corner icons occupy the margin. */
    framed: themed || design.cornerIcon !== 'none',
  };
}

export function editableBoardStyle(options: BoardStyleOptions = {}): BoardDesignValues {
  const {
    backgroundColor,
    badgeColor,
    labelColor,
    borderColor,
    numberColor,
    font,
    borderStyle,
    cornerIcon,
  } = resolveBoardStyle(options);
  return {
    backgroundColor,
    badgeColor,
    labelColor,
    borderColor,
    numberColor,
    font,
    borderStyle,
    cornerIcon,
  };
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
  if (!style.framed) return;
  ctx.save();
  ctx.strokeStyle = style.borderColor;
  ctx.lineWidth = 5;
  const margin = 80;
  if (style.themed) {
    if (style.borderStyle === 'dashed') ctx.setLineDash([24, 18]);
    ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
    ctx.setLineDash([]);
    if (style.borderStyle !== 'solid' && style.borderStyle !== 'dashed') {
      ctx.lineWidth = 2;
      const inner = margin + 15;
      ctx.strokeRect(inner, inner, width - inner * 2, height - inner * 2);
    }
  }
  if (style.cornerIcon !== 'none') drawCornerIcons(ctx, width, height, style.cornerIcon);
  ctx.restore();
}

/** Icon box size in board pixels; the 100-unit SVG box is scaled to this. */
const CORNER_ICON_PX = 145;
const CORNER_INSET = 120;

function drawCornerIcons(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  id: keyof typeof cornerIconDefinitions
) {
  const icon = cornerIconDefinitions[id];
  const path = new Path2D(icon.path);
  const scale = CORNER_ICON_PX / 100;
  const far = (edge: number) => edge - CORNER_INSET;
  // Corner points clockwise from top-left with the rotation that points the
  // icon's +x/+y quadrant into the page.
  const corners = [
    [CORNER_INSET, CORNER_INSET, 0],
    [far(width), CORNER_INSET, Math.PI / 2],
    [far(width), far(height), Math.PI],
    [CORNER_INSET, far(height), -Math.PI / 2],
  ] as const;
  ctx.lineWidth = 2.5 / scale;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const [x, y, angle] of corners) {
    ctx.save();
    if (icon.orient === 'rotate') {
      ctx.translate(x, y);
      ctx.rotate(angle);
    } else {
      // Keep the artwork upright; shift its box so it sits inside the corner.
      ctx.translate(
        x < width / 2 ? x : x - CORNER_ICON_PX,
        y < height / 2 ? y : y - CORNER_ICON_PX
      );
    }
    ctx.scale(scale, scale);
    ctx.stroke(path);
    ctx.restore();
  }
}
