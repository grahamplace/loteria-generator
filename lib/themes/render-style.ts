import {
  getTheme,
  boardBorderStyle,
  boardCardBorderStyle,
  boardCornerIcon,
  type BoardStyleOptions,
  type BoardDesignValues,
  type ThemeId,
  type PrintFont,
} from './presets';
import { cornerIconDefinitions, type CornerIconDefinition } from './corner-icons';
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
    cardColor: color('card'),
    cardTextColor: color('card-ink'),
    font: preset.font,
    borderStyle: boardBorderStyle({ presetId: id }),
    cardBorderStyle: boardCardBorderStyle({ presetId: id }),
    cornerIcon: boardCornerIcon({ presetId: id }),
  };
}

export function resolveBoardStyle(options: BoardStyleOptions = {}) {
  // Boards saved before themes have no presetId. They print in Classic colors,
  // which match the old hardcoded export colors, and keep the old cut guides.
  const legacy = !options.presetId;
  const defaults = presetBoardStyle(getTheme(options.presetId).id);
  const design: BoardDesignValues = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof BoardDesignValues)[]) {
    // Assign only defined fields; legacy boards may contain partial color settings.
    if (options[key] !== undefined) Object.assign(design, { [key]: options[key] });
  }
  // Resolve retired decorations on read so existing boards and Custom history
  // match the current picker and exports without rewriting saved designs.
  const borderStyle = boardBorderStyle(options);
  design.cardBorderStyle = boardCardBorderStyle(options);
  design.cornerIcon = boardCornerIcon(options);
  // Designs saved before cards had their own colors drew cards in the page
  // background and title colors; keep printing them that way.
  if (options.cardColor === undefined && options.backgroundColor !== undefined)
    design.cardColor = options.backgroundColor;
  if (options.cardTextColor === undefined && options.labelColor !== undefined)
    design.cardTextColor = options.labelColor;
  const themed = borderStyle !== 'hand-drawn' && borderStyle !== 'none';
  return {
    ...design,
    borderStyle,
    legacy,
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
    cardColor,
    cardTextColor,
    font,
    borderStyle,
    cardBorderStyle,
    cornerIcon,
  } = resolveBoardStyle(options);
  return {
    backgroundColor,
    badgeColor,
    labelColor,
    borderColor,
    numberColor,
    cardColor,
    cardTextColor,
    font,
    borderStyle,
    cardBorderStyle,
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
    strokeBorder(ctx, margin, margin, width - margin * 2, height - margin * 2, style.borderStyle, {
      line: 5,
      gap: 15,
    });
  }
  if (style.cornerIcon !== 'none') drawCornerIcons(ctx, width, height, style.cornerIcon);
  ctx.restore();
}

/**
 * Strokes a rectangle in one of the shared border styles, in the current
 * stroke color. `line` is the main stroke width and `gap` the spacing to a
 * second, inner line. Hand-drawn and none are handled by the callers.
 */
export function strokeBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: BoardDesignValues['cardBorderStyle'],
  { line, gap }: { line: number; gap: number }
) {
  ctx.save();
  ctx.lineWidth = line;
  if (style === 'dashed') ctx.setLineDash([line * 5, line * 3.5]);
  if (style === 'dotted') {
    // Zero-length dashes with round caps draw evenly spaced dots.
    ctx.lineWidth = line * 2.6;
    ctx.lineCap = 'round';
    ctx.setLineDash([0, line * 5.5]);
  }
  if (style === 'thick-thin') {
    // A heavy outer rule with a fine inner one, like a printed certificate.
    ctx.lineWidth = line * 2.4;
    const half = ctx.lineWidth / 2;
    ctx.strokeRect(x + half, y + half, w - half * 2, h - half * 2);
    ctx.lineWidth = Math.max(1.5, line * 0.4);
    const inset = gap + line * 1.4;
    ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
  } else {
    ctx.strokeRect(x, y, w, h);
  }
  if (style === 'double') {
    ctx.lineWidth = Math.max(1.5, line * 0.4);
    ctx.strokeRect(x + gap, y + gap, w - gap * 2, h - gap * 2);
  }
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
  const icon: CornerIconDefinition = cornerIconDefinitions[id];
  const path = new Path2D(icon.path);
  const artPx = CORNER_ICON_PX * (icon.size ?? 1);
  const scale = artPx / (icon.viewBox ?? 100);
  const far = (edge: number) => edge - CORNER_INSET;
  // Corner points clockwise from top-left with the rotation that points the
  // icon's +x/+y quadrant into the page.
  const corners = [
    [CORNER_INSET, CORNER_INSET, 0],
    [far(width), CORNER_INSET, Math.PI / 2],
    [far(width), far(height), Math.PI],
    [CORNER_INSET, far(height), -Math.PI / 2],
  ] as const;
  ctx.fillStyle = ctx.strokeStyle;
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
      ctx.translate(x < width / 2 ? x : x - artPx, y < height / 2 ? y : y - artPx);
    }
    ctx.scale(scale, scale);
    if (icon.paint === 'fill') ctx.fill(path, icon.fillRule);
    else ctx.stroke(path);
    ctx.restore();
  }
}
