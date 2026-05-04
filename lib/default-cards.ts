/**
 * Default ("classic") Lotería cards. Static manifest of pre-illustrated cards
 * that users can add to a board without uploading a photo or triggering AI
 * generation.
 *
 * IMMUTABILITY RULE: once an entry is shipped, never delete the webp file or
 * rename its `id` — existing user boards reference these by id and by URL.
 * You may add new entries freely, and you may update `label`/`labelEn`/
 * `traditionalNumber` for an existing entry. Do not change `id` or `src`.
 *
 * Adding a new classic is two steps:
 *   1. Drop the webp at `public/default-cards/<id>.webp` (600×900, q=85)
 *   2. Add a row to DEFAULT_CARDS below
 */
export interface DefaultCard {
  /** Stable kebab-case identifier. Never rename. */
  id: string;
  /** Canonical Spanish name (e.g. "La Rosa"). User-editable after add. */
  label: string;
  /** English helper, shown in the picker tooltip on en locale. */
  labelEn: string;
  /** Position in the canonical 54-card deck, if applicable. */
  traditionalNumber?: number;
  /** Public URL of the webp. Always `/default-cards/${id}.webp`. */
  src: string;
}

export const DEFAULT_CARDS: readonly DefaultCard[] = [
  {
    id: 'el-gallo',
    label: 'El Gallo',
    labelEn: 'The Rooster',
    traditionalNumber: 1,
    src: '/default-cards/el-gallo.webp',
  },
  {
    id: 'la-luna',
    label: 'La Luna',
    labelEn: 'The Moon',
    traditionalNumber: 23,
    src: '/default-cards/la-luna.webp',
  },
  {
    id: 'el-corazon',
    label: 'El Corazón',
    labelEn: 'The Heart',
    traditionalNumber: 27,
    src: '/default-cards/el-corazon.webp',
  },
  {
    id: 'la-sandia',
    label: 'La Sandía',
    labelEn: 'The Watermelon',
    traditionalNumber: 28,
    src: '/default-cards/la-sandia.webp',
  },
  {
    id: 'la-estrella',
    label: 'La Estrella',
    labelEn: 'The Star',
    traditionalNumber: 35,
    src: '/default-cards/la-estrella.webp',
  },
  {
    id: 'el-mundo',
    label: 'El Mundo',
    labelEn: 'The World',
    traditionalNumber: 37,
    src: '/default-cards/el-mundo.webp',
  },
  {
    id: 'la-rosa',
    label: 'La Rosa',
    labelEn: 'The Rose',
    traditionalNumber: 41,
    src: '/default-cards/la-rosa.webp',
  },
  {
    id: 'el-sol',
    label: 'El Sol',
    labelEn: 'The Sun',
    traditionalNumber: 46,
    src: '/default-cards/el-sol.webp',
  },
  {
    id: 'el-pescado',
    label: 'El Pescado',
    labelEn: 'The Fish',
    traditionalNumber: 50,
    src: '/default-cards/el-pescado.webp',
  },
];

export const DEFAULT_CARDS_BY_ID: Record<string, DefaultCard | undefined> = Object.fromEntries(
  DEFAULT_CARDS.map((card) => [card.id, card])
);
