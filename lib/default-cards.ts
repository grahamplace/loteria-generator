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

export const DEFAULT_CARDS: DefaultCard[] = [
  {
    id: 'la-rosa',
    label: 'La Rosa',
    labelEn: 'The Rose',
    traditionalNumber: 41,
    src: '/default-cards/la-rosa.webp',
  },
];

export const DEFAULT_CARDS_BY_ID: Record<string, DefaultCard> = Object.fromEntries(
  DEFAULT_CARDS.map((card) => [card.id, card])
);
