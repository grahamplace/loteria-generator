/** Lightweight render definitions. Color values live in app/globals.css. */
import { cornerIcons, type CornerIcon } from './corner-icons';
export { cornerIcons, type CornerIcon };
export type PhotoMode = 'illustrated' | 'original';
export const printFonts = [
  'Jost',
  'Caveat',
  'Creepster',
  'Bebas Neue',
  'Montserrat',
  'Playfair Display',
  'Fredoka',
  'Roboto Slab',
  'Cinzel',
  'Rye',
] as const;
export type PrintFont = (typeof printFonts)[number];
export const borderStyles = [
  'hand-drawn',
  'none',
  'solid',
  'double',
  'thick-thin',
  'dashed',
  'dotted',
] as const;
/**
 * Frames drawn around the whole board. A saved `hand-drawn` board border
 * never drew a frame, so it reads as `none`.
 */
export const boardFrameStyles = borderStyles.filter((style) => style !== 'hand-drawn');
/**
 * Still accepted from saved boards and older clients; rendered as a plain
 * double border. `web` and `pencils` also imply their corner icon.
 */
export const legacyBorderStyles = [
  'web',
  'pencils',
  'stars',
  'confetti',
  'leaves',
  'floral',
  'sport',
  'waves',
  'papel',
] as const;
export type CurrentBorderStyle = (typeof borderStyles)[number];
export type BorderStyle = CurrentBorderStyle | (typeof legacyBorderStyles)[number];
export type BoardThemeId = ThemeId | 'custom';
export interface BoardDesignValues {
  backgroundColor: string;
  badgeColor: string;
  numberColor: string;
  labelColor: string;
  borderColor: string;
  /** Card fill; boards saved before it existed use the background color. */
  cardColor: string;
  /** Card labels; boards saved before it existed use the title color. */
  cardTextColor: string;
  font: PrintFont;
  /** Page frame. Before `cardBorderStyle` existed it also styled the cards. */
  borderStyle: BorderStyle;
  cardBorderStyle: CurrentBorderStyle;
  cornerIcon: CornerIcon;
}
export interface BoardStyleOptions extends Partial<BoardDesignValues> {
  presetId?: BoardThemeId;
  showTitle?: boolean;
  /** Last custom design for this board, maintained by the settings API. */
  customDesign?: Partial<BoardDesignValues>;
}

const designKeys = [
  'backgroundColor',
  'badgeColor',
  'numberColor',
  'labelColor',
  'borderColor',
  'cardColor',
  'cardTextColor',
  'font',
  'borderStyle',
  'cardBorderStyle',
  'cornerIcon',
] as const satisfies readonly (keyof BoardDesignValues)[];

function designValues(options: BoardStyleOptions): Partial<BoardDesignValues> {
  const design: Partial<BoardDesignValues> = {};
  for (const key of designKeys) {
    if (options[key] !== undefined) Object.assign(design, { [key]: options[key] });
  }
  return design;
}

export function selectedBoardTheme(options?: BoardStyleOptions | null): BoardThemeId {
  if (options?.presetId) return options.presetId;
  return options && designKeys.some((key) => options[key] !== undefined) ? 'custom' : 'classic';
}

/** Preserve a board's last custom design independently of its active preset. */
export function mergeBoardStyles(
  previous: BoardStyleOptions | null | undefined,
  patch: BoardStyleOptions
): BoardStyleOptions {
  const update = { ...patch };
  // History comes from the saved board, never a potentially stale client snapshot.
  delete update.customDesign;
  const customDesign =
    previous && selectedBoardTheme(previous) === 'custom'
      ? designValues(previous)
      : previous?.customDesign;
  const restoreCustom =
    update.presetId === 'custom' && customDesign && Object.keys(designValues(update)).length === 0;
  const replacePreset =
    update.presetId && update.presetId !== 'custom' && update.presetId !== previous?.presetId;
  const base = restoreCustom
    ? { showTitle: previous?.showTitle, ...customDesign }
    : replacePreset
      ? { showTitle: previous?.showTitle }
      : previous;
  const next: BoardStyleOptions = { ...base, ...update };
  const latestCustom = selectedBoardTheme(next) === 'custom' ? designValues(next) : customDesign;
  if (latestCustom) next.customDesign = latestCustom;
  return next;
}
/**
 * Each preset's look. Colors live in app/globals.css as --loteria-<id>-*.
 * `border` frames the page and `cardBorder` outlines each card.
 */
export const themePresets = [
  {
    id: 'classic',
    name: { en: 'Classic', 'es-MX': 'Clásica' },
    corner: 'none',
    font: 'Jost',
    border: 'hand-drawn',
    cardBorder: 'hand-drawn',
  },
  {
    id: 'halloween',
    name: { en: 'Halloween', 'es-MX': 'Halloween' },
    corner: 'cobweb',
    font: 'Creepster',
    border: 'double',
    cardBorder: 'solid',
  },
  {
    id: 'christmas',
    name: { en: 'Christmas', 'es-MX': 'Navidad' },
    corner: 'holly',
    font: 'Playfair Display',
    border: 'thick-thin',
    cardBorder: 'double',
  },
  {
    id: 'birthday',
    name: { en: 'Birthday', 'es-MX': 'Cumpleaños' },
    corner: 'cake',
    font: 'Fredoka',
    border: 'dotted',
    cardBorder: 'solid',
  },
  {
    id: 'family-reunion',
    name: { en: 'Family Reunion', 'es-MX': 'Reunión familiar' },
    corner: 'flower',
    font: 'Roboto Slab',
    border: 'thick-thin',
    cardBorder: 'double',
  },
  {
    id: 'quinceanera',
    name: { en: 'Quincea\u00f1era', 'es-MX': 'Quinceañera' },
    corner: 'tiara',
    font: 'Playfair Display',
    border: 'thick-thin',
    cardBorder: 'double',
  },
  {
    id: 'wedding',
    name: { en: 'Wedding', 'es-MX': 'Boda' },
    corner: 'rings',
    font: 'Cinzel',
    border: 'double',
    cardBorder: 'solid',
  },
  {
    id: 'baby-shower-boy',
    name: { en: 'Baby Shower (Boy)', 'es-MX': 'Baby shower (niño)' },
    corner: 'rattle',
    font: 'Fredoka',
    border: 'dashed',
    cardBorder: 'solid',
  },
  {
    id: 'baby-shower-girl',
    name: { en: 'Baby Shower (Girl)', 'es-MX': 'Baby shower (niña)' },
    corner: 'pacifier',
    font: 'Fredoka',
    border: 'dashed',
    cardBorder: 'solid',
  },
  {
    id: 'bridal-shower',
    name: { en: 'Bridal Shower', 'es-MX': 'Despedida de soltera' },
    corner: 'flower',
    font: 'Playfair Display',
    border: 'double',
    cardBorder: 'solid',
  },
  {
    id: 'bachelorette',
    name: { en: 'Bachelorette', 'es-MX': 'Fiesta de amigas' },
    corner: 'disco-ball',
    font: 'Bebas Neue',
    border: 'dotted',
    cardBorder: 'solid',
  },
  {
    id: 'friendsgiving',
    name: { en: 'Friendsgiving', 'es-MX': 'Cena de amigos' },
    corner: 'maple-leaf',
    font: 'Roboto Slab',
    border: 'thick-thin',
    cardBorder: 'double',
  },
  {
    id: 'graduation',
    name: { en: 'Graduation', 'es-MX': 'Graduación' },
    corner: 'grad-cap',
    font: 'Cinzel',
    border: 'thick-thin',
    cardBorder: 'solid',
  },
  {
    id: 'classroom',
    name: { en: 'Classroom', 'es-MX': 'Salón de clases' },
    corner: 'pencil',
    font: 'Caveat',
    border: 'solid',
    cardBorder: 'dashed',
  },
  {
    id: 'anniversary',
    name: { en: 'Wedding Anniversary', 'es-MX': 'Aniversario de bodas' },
    corner: 'rings',
    font: 'Playfair Display',
    border: 'thick-thin',
    cardBorder: 'double',
  },
  {
    id: 'soccer-team',
    name: { en: 'Soccer Team', 'es-MX': 'Equipo de fútbol' },
    corner: 'soccer',
    font: 'Bebas Neue',
    border: 'solid',
    cardBorder: 'solid',
  },
  {
    id: 'new-years',
    name: { en: "New Year's", 'es-MX': 'Año Nuevo' },
    corner: 'champagne',
    font: 'Bebas Neue',
    border: 'dotted',
    cardBorder: 'thick-thin',
  },
  {
    id: 'milestone-birthday',
    name: { en: '50th Birthday', 'es-MX': 'Cumpleaños especial' },
    corner: 'balloon',
    font: 'Bebas Neue',
    border: 'dotted',
    cardBorder: 'solid',
  },
  {
    id: 'destination-wedding',
    name: { en: 'Destination Wedding', 'es-MX': 'Boda de destino' },
    corner: 'palm-tree',
    font: 'Montserrat',
    border: 'double',
    cardBorder: 'solid',
  },
  {
    id: 'cinco-de-mayo',
    name: { en: 'Cinco de Mayo', 'es-MX': 'Cinco de Mayo' },
    corner: 'maracas',
    font: 'Rye',
    border: 'dotted',
    cardBorder: 'double',
  },
  {
    id: 'hanukkah',
    name: { en: 'Hanukkah', 'es-MX': 'Janucá' },
    corner: 'menorah',
    font: 'Cinzel',
    border: 'double',
    cardBorder: 'solid',
  },
  {
    id: 'easter',
    name: { en: 'Easter', 'es-MX': 'Pascua' },
    corner: 'easter-egg',
    font: 'Fredoka',
    border: 'dotted',
    cardBorder: 'dashed',
  },
] as const satisfies readonly {
  id: string;
  name: { en: string; 'es-MX': string };
  corner: CornerIcon;
  font: PrintFont;
  border: CurrentBorderStyle;
  cardBorder: CurrentBorderStyle;
}[];
export type ThemeId = (typeof themePresets)[number]['id'];
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themePresets.some((preset) => preset.id === value);
}
export function getTheme(id?: string | null) {
  return themePresets.find((preset) => preset.id === id) ?? themePresets[0];
}
function currentBorderStyle(border: BorderStyle): CurrentBorderStyle {
  return legacyBorderStyles.some((legacy) => legacy === border)
    ? 'double'
    : (border as CurrentBorderStyle);
}
export function boardBorderStyle(options?: BoardStyleOptions | null): CurrentBorderStyle {
  return currentBorderStyle(options?.borderStyle ?? getTheme(options?.presetId).border);
}
/**
 * Explicit choice, then the page border for designs saved when one style
 * drew both, then the preset's.
 */
export function boardCardBorderStyle(options?: BoardStyleOptions | null): CurrentBorderStyle {
  if (options?.cardBorderStyle) return options.cardBorderStyle;
  if (options?.borderStyle) return currentBorderStyle(options.borderStyle);
  return getTheme(options?.presetId).cardBorder;
}
/** Explicit choice, then the corner implied by a legacy border, then the preset's. */
export function boardCornerIcon(options?: BoardStyleOptions | null): CornerIcon {
  if (options?.cornerIcon) return options.cornerIcon;
  if (options?.borderStyle === 'web') return 'cobweb';
  if (options?.borderStyle === 'pencils') return 'pencil';
  return getTheme(options?.presetId).corner;
}
export function themeVariables(id: ThemeId) {
  return {
    '--theme-paper': `var(--loteria-${id}-paper)`,
    '--theme-ink': `var(--loteria-${id}-ink)`,
    '--theme-badge': `var(--loteria-${id}-badge)`,
    '--theme-accent': `var(--loteria-${id}-accent)`,
    '--theme-font': `'${getTheme(id).font}', var(--font-jost), sans-serif`,
  };
}

/** CSS colors for a saved design, including legacy and customized presets. */
export function boardThemeVariables(options?: BoardStyleOptions | null) {
  return {
    ...themeVariables(getTheme(options?.presetId).id),
    ...(options?.backgroundColor && { '--theme-paper': options.backgroundColor }),
    ...(options?.labelColor && { '--theme-ink': options.labelColor }),
    ...(options?.badgeColor && { '--theme-badge': options.badgeColor }),
    ...(options?.borderColor && { '--theme-accent': options.borderColor }),
    ...(options?.font && { '--theme-font': `'${options.font}', var(--font-jost), sans-serif` }),
  };
}
