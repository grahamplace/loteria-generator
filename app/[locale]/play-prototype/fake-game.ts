/**
 * PROTOTYPE ONLY — fake Game state for the Player-board prototype (ticket 08).
 * No server, no socket, no persistence. Everything here is thrown away.
 *
 * Card names come from the default-card filenames; accents are best-effort and
 * want a native review before any of this becomes real copy.
 */

export type FakeCard = { id: string; slug: string; name: string };

const CARDS: Array<[string, string]> = [
  ['el-alacran', 'El Alacrán'],
  ['el-arbol', 'El Árbol'],
  ['el-arpa', 'El Arpa'],
  ['el-bandolon', 'El Bandolón'],
  ['el-barril', 'El Barril'],
  ['el-camaron', 'El Camarón'],
  ['el-cantarito', 'El Cantarito'],
  ['el-catrin', 'El Catrín'],
  ['el-corazon', 'El Corazón'],
  ['el-cotorro', 'El Cotorro'],
  ['el-gallo', 'El Gallo'],
  ['el-melon', 'El Melón'],
  ['el-mundo', 'El Mundo'],
  ['el-musico', 'El Músico'],
  ['el-nopal', 'El Nopal'],
  ['el-pajaro', 'El Pájaro'],
];

/** The Player's Board: 16 cards, position i is grid cell i (ticket 04). */
export const BOARD: FakeCard[] = CARDS.map(([slug, name], i) => ({
  id: `card-${i}`,
  slug,
  name,
}));

export const imageFor = (c: FakeCard) => `/default-cards/${c.slug}.webp`;

/** Cells that have been Called. Mid-game: 9 of 16, one row nearly complete. */
export const CALLED_CELLS = new Set([0, 1, 2, 4, 5, 7, 9, 12, 13]);

/** Marks the Player has already tapped — deliberately behind the Calls. */
export const INITIAL_MARKED = new Set([0, 1, 2, 4, 7, 12]);

export const GAME = {
  code: '482913',
  patternLabel: 'Any row',
  /** Cell indices of each instance of the Pattern (ticket 07). */
  patternInstances: [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
  ],
  lastCalled: BOARD[9],
  calledCount: 23,
  playerCount: 12,
  offlineCount: 2,
  oneAwayCount: 3,
  youAreOneAway: false,
  nextCallDueInMs: 12_000,
};

/** Recent Calls, newest first — some are not on this Board. */
export const RECENT_CALLS: string[] = [
  'El Cotorro',
  'La Sirena',
  'El Nopal',
  'La Luna',
  'El Barril',
  'El Valiente',
  'El Arpa',
  'La Dama',
];

export type VariantProps = {
  marked: Set<number>;
  onToggle: (cell: number) => void;
  onClaim: () => void;
  claimState: 'idle' | 'pending' | 'rejected-not-called' | 'rejected-not-marked' | 'won';
};
