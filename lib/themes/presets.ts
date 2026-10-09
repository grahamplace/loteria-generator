/** Lightweight render definitions. Color values live in app/globals.css. */
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
] as const;
export type PrintFont = (typeof printFonts)[number];
export const borderStyles = [
  'hand-drawn',
  'none',
  'solid',
  'double',
  'dashed',
  'web',
  'pencils',
] as const;
/** Still accepted from saved boards and older clients; rendered as a plain double border. */
export const legacyBorderStyles = [
  'stars',
  'confetti',
  'leaves',
  'floral',
  'sport',
  'waves',
  'papel',
] as const;
export type BorderStyle = (typeof borderStyles)[number] | (typeof legacyBorderStyles)[number];
export type BoardThemeId = ThemeId | 'custom';
export interface BoardDesignValues {
  backgroundColor: string;
  badgeColor: string;
  numberColor: string;
  labelColor: string;
  borderColor: string;
  font: PrintFont;
  borderStyle: BorderStyle;
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
  'font',
  'borderStyle',
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
export type FrameStyle = 'none' | 'web' | 'pencils';
export const themePresets = [
  { id: 'classic', name: { en: 'Classic', 'es-MX': 'Clásica' }, frame: 'none', font: 'Jost' },
  {
    id: 'halloween',
    name: { en: 'Halloween', 'es-MX': 'Halloween' },
    frame: 'web',
    font: 'Creepster',
  },
  { id: 'christmas', name: { en: 'Christmas', 'es-MX': 'Navidad' }, frame: 'none', font: 'Jost' },
  {
    id: 'birthday',
    name: { en: 'Birthday', 'es-MX': 'Cumpleaños' },
    frame: 'none',
    font: 'Bebas Neue',
  },
  {
    id: 'family-reunion',
    name: { en: 'Family Reunion', 'es-MX': 'Reunión familiar' },
    frame: 'none',
    font: 'Jost',
  },
  {
    id: 'quinceanera',
    name: { en: 'Quincea\u00f1era', 'es-MX': 'Quinceañera' },
    frame: 'none',
    font: 'Jost',
  },
  { id: 'wedding', name: { en: 'Wedding', 'es-MX': 'Boda' }, frame: 'none', font: 'Jost' },
  {
    id: 'baby-shower',
    name: { en: 'Baby Shower', 'es-MX': 'Baby shower' },
    frame: 'none',
    font: 'Jost',
  },
  {
    id: 'bridal-shower',
    name: { en: 'Bridal Shower', 'es-MX': 'Despedida de soltera' },
    frame: 'none',
    font: 'Jost',
  },
  {
    id: 'bachelorette',
    name: { en: 'Bachelorette', 'es-MX': 'Fiesta de amigas' },
    frame: 'none',
    font: 'Jost',
  },
  {
    id: 'friendsgiving',
    name: { en: 'Friendsgiving', 'es-MX': 'Cena de amigos' },
    frame: 'none',
    font: 'Jost',
  },
  {
    id: 'graduation',
    name: { en: 'Graduation', 'es-MX': 'Graduación' },
    frame: 'none',
    font: 'Bebas Neue',
  },
  {
    id: 'classroom',
    name: { en: 'Classroom', 'es-MX': 'Salón de clases' },
    frame: 'pencils',
    font: 'Bebas Neue',
  },
  {
    id: 'anniversary',
    name: { en: 'Wedding Anniversary', 'es-MX': 'Aniversario de bodas' },
    frame: 'none',
    font: 'Jost',
  },
  {
    id: 'soccer-team',
    name: { en: 'Soccer Team', 'es-MX': 'Equipo de fútbol' },
    frame: 'none',
    font: 'Bebas Neue',
  },
  {
    id: 'new-years',
    name: { en: "New Year's", 'es-MX': 'Año Nuevo' },
    frame: 'none',
    font: 'Bebas Neue',
  },
  {
    id: 'milestone-birthday',
    name: { en: '50th Birthday', 'es-MX': 'Cumpleaños especial' },
    frame: 'none',
    font: 'Bebas Neue',
  },
  {
    id: 'destination-wedding',
    name: { en: 'Destination Wedding', 'es-MX': 'Boda de destino' },
    frame: 'none',
    font: 'Jost',
  },
  {
    id: 'cinco-de-mayo',
    name: { en: 'Cinco de Mayo', 'es-MX': 'Cinco de Mayo' },
    frame: 'none',
    font: 'Jost',
  },
  {
    id: 'original-photos',
    name: { en: 'Photo Loter\u00eda', 'es-MX': 'Fotos originales' },
    frame: 'none',
    font: 'Jost',
  },
  { id: 'hanukkah', name: { en: 'Hanukkah', 'es-MX': 'Janucá' }, frame: 'none', font: 'Jost' },
  { id: 'easter', name: { en: 'Easter', 'es-MX': 'Pascua' }, frame: 'none', font: 'Jost' },
] as const;
export type ThemeId = (typeof themePresets)[number]['id'];
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themePresets.some((preset) => preset.id === value);
}
export function getTheme(id?: string | null) {
  return themePresets.find((preset) => preset.id === id) ?? themePresets[0];
}
export function boardBorderStyle(options?: BoardStyleOptions | null): BorderStyle {
  const preset = getTheme(options?.presetId);
  const border =
    options?.borderStyle ??
    (preset.id === 'classic' ? 'hand-drawn' : preset.frame === 'none' ? 'double' : preset.frame);
  return legacyBorderStyles.some((legacy) => legacy === border) ? 'double' : border;
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
