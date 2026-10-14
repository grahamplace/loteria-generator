/**
 * Corner icons drawn in the four corners of a printed board.
 *
 * Each icon is SVG path data in a 100×100 box whose origin (0, 0) is the
 * board's corner point, so artwork extends right and down into the page.
 * Icons are stroked in the board's border color. To add one, append an entry
 * here, list it in `cornerIcons`, and give it an English and Mexican Spanish label under
 * `Themes.corners` in messages/*.json.
 *
 * - `rotate`: turn the icon for each corner (webs, pencils pointing inward).
 * - `upright`: keep the icon upright and shift it into each corner (hearts,
 *   stars, anything with a top and bottom).
 */
export interface CornerIconDefinition {
  path: string;
  orient: 'rotate' | 'upright';
}

export const cornerIconDefinitions = {
  cobweb: {
    orient: 'rotate',
    path:
      'M0 0 L100 0 M0 0 L92.4 38.3 M0 0 L70.7 70.7 M0 0 L38.3 92.4 M0 0 L0 100 ' +
      'M28 0 A28 28 0 0 1 0 28 M55 0 A55 55 0 0 1 0 55 M83 0 A83 83 0 0 1 0 83',
  },
  pencil: {
    orient: 'rotate',
    path:
      'M9.9 1.4 L48.1 39.6 L55.2 55.2 L39.6 48.1 L1.4 9.9 Z M15.6 7.1 L7.1 15.6 ' +
      'M48.1 39.6 L39.6 48.1 M53 50.3 L50.3 53',
  },
  star: {
    orient: 'upright',
    path:
      'M38 14 L43.9 29.9 L60.8 30.6 L47.5 41.1 L52.1 57.4 L38 48 L23.9 57.4 L28.5 41.1 ' +
      'L15.2 30.6 L32.1 29.9 Z M76 13 L78.2 18.9 L84.6 19.2 L79.6 23.2 L81.3 29.3 L76 25.8 ' +
      'L70.7 29.3 L72.4 23.2 L67.4 19.2 L73.8 18.9 Z M22 67 L24.2 72.9 L30.6 73.2 L25.6 77.2 ' +
      'L27.3 83.3 L22 79.8 L16.7 83.3 L18.4 77.2 L13.4 73.2 L19.8 72.9 Z',
  },
  heart: {
    orient: 'upright',
    path:
      'M40 62 C12 44 14 18 30 20 C36 21 40 26 40 30 C40 26 44 21 50 20 C66 18 68 44 40 62 Z ' +
      'M78 30.4 C67.4 23.5 68.1 13.6 74.2 14.4 C76.5 14.8 78 16.7 78 18.2 C78 16.7 79.5 14.8 ' +
      '81.8 14.4 C87.9 13.6 88.6 23.5 78 30.4 Z M22 86.4 C11.4 79.5 12.1 69.6 18.2 70.4 ' +
      'C20.5 70.8 22 72.7 22 74.2 C22 72.7 23.5 70.8 25.8 70.4 C31.9 69.6 32.6 79.5 22 86.4 Z',
  },
  flower: {
    orient: 'upright',
    path:
      'M29 24 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 M44.2 35.1 a11 11 0 1 0 22 0 ' +
      'a11 11 0 1 0 -22 0 M38.4 52.9 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 M19.6 52.9 ' +
      'a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 M13.8 35.1 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 ' +
      'M34 40 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0',
  },
} as const satisfies Record<string, CornerIconDefinition>;

export type CornerIconId = keyof typeof cornerIconDefinitions;
/** Selector order; every definition must be listed (checked below). */
export const cornerIcons = ['none', 'cobweb', 'pencil', 'star', 'heart', 'flower'] as const;
export type CornerIcon = (typeof cornerIcons)[number];
type Missing = Exclude<CornerIconId, CornerIcon>;
const allListed: Missing extends never ? true : Missing = true;
void allListed;
