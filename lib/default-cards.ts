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
    id: 'la-dama',
    label: 'La Dama',
    labelEn: 'The Lady',
    traditionalNumber: 3,
    src: '/default-cards/la-dama.webp',
  },
  {
    id: 'el-catrin',
    label: 'El Catrín',
    labelEn: 'The Dapper Gentleman',
    traditionalNumber: 4,
    src: '/default-cards/el-catrin.webp',
  },
  {
    id: 'el-paraguas',
    label: 'El Paraguas',
    labelEn: 'The Umbrella',
    traditionalNumber: 5,
    src: '/default-cards/el-paraguas.webp',
  },
  {
    id: 'la-sirena',
    label: 'La Sirena',
    labelEn: 'The Mermaid',
    traditionalNumber: 6,
    src: '/default-cards/la-sirena.webp',
  },
  {
    id: 'la-escalera',
    label: 'La Escalera',
    labelEn: 'The Ladder',
    traditionalNumber: 7,
    src: '/default-cards/la-escalera.webp',
  },
  {
    id: 'la-botella',
    label: 'La Botella',
    labelEn: 'The Bottle',
    traditionalNumber: 8,
    src: '/default-cards/la-botella.webp',
  },
  {
    id: 'el-barril',
    label: 'El Barril',
    labelEn: 'The Barrel',
    traditionalNumber: 9,
    src: '/default-cards/el-barril.webp',
  },
  {
    id: 'el-arbol',
    label: 'El Árbol',
    labelEn: 'The Tree',
    traditionalNumber: 10,
    src: '/default-cards/el-arbol.webp',
  },
  {
    id: 'el-melon',
    label: 'El Melón',
    labelEn: 'The Melon',
    traditionalNumber: 11,
    src: '/default-cards/el-melon.webp',
  },
  {
    id: 'el-valiente',
    label: 'El Valiente',
    labelEn: 'The Brave Man',
    traditionalNumber: 12,
    src: '/default-cards/el-valiente.webp',
  },
  {
    id: 'el-gorrito',
    label: 'El Gorrito',
    labelEn: 'The Little Bonnet',
    traditionalNumber: 13,
    src: '/default-cards/el-gorrito.webp',
  },
  {
    id: 'la-muerte',
    label: 'La Muerte',
    labelEn: 'Death',
    traditionalNumber: 14,
    src: '/default-cards/la-muerte.webp',
  },
  {
    id: 'la-pera',
    label: 'La Pera',
    labelEn: 'The Pear',
    traditionalNumber: 15,
    src: '/default-cards/la-pera.webp',
  },
  {
    id: 'la-bandera',
    label: 'La Bandera',
    labelEn: 'The Flag',
    traditionalNumber: 16,
    src: '/default-cards/la-bandera.webp',
  },
  {
    id: 'la-mano',
    label: 'La Mano',
    labelEn: 'The Hand',
    traditionalNumber: 21,
    src: '/default-cards/la-mano.webp',
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
    id: 'el-nopal',
    label: 'El Nopal',
    labelEn: 'The Prickly Pear',
    traditionalNumber: 39,
    src: '/default-cards/el-nopal.webp',
  },
  {
    id: 'la-rosa',
    label: 'La Rosa',
    labelEn: 'The Rose',
    traditionalNumber: 41,
    src: '/default-cards/la-rosa.webp',
  },
  {
    id: 'la-calavera',
    label: 'La Calavera',
    labelEn: 'The Skull',
    traditionalNumber: 42,
    src: '/default-cards/la-calavera.webp',
  },
  {
    id: 'la-campana',
    label: 'La Campana',
    labelEn: 'The Bell',
    traditionalNumber: 43,
    src: '/default-cards/la-campana.webp',
  },
  {
    id: 'el-venado',
    label: 'El Venado',
    labelEn: 'The Deer',
    traditionalNumber: 45,
    src: '/default-cards/el-venado.webp',
  },
  {
    id: 'el-sol',
    label: 'El Sol',
    labelEn: 'The Sun',
    traditionalNumber: 46,
    src: '/default-cards/el-sol.webp',
  },
  {
    id: 'la-corona',
    label: 'La Corona',
    labelEn: 'The Crown',
    traditionalNumber: 47,
    src: '/default-cards/la-corona.webp',
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
