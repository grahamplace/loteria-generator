/**
 * PROTOTYPE ONLY — fake Caller-side Game state (ticket 09).
 * No server, no socket, no persistence. Thrown away once a variant wins.
 * Card names are best-effort accents off the default-card filenames.
 */

export type Phase = 'lobby' | 'playing' | 'claim-window';

export const CARD_SLUGS = [
  'el-alacran',
  'el-arbol',
  'el-arpa',
  'el-bandolon',
  'el-barril',
  'el-camaron',
  'el-cantarito',
  'el-catrin',
  'el-corazon',
  'el-cotorro',
  'el-gallo',
  'el-melon',
  'el-mundo',
  'el-musico',
  'el-nopal',
  'el-pajaro',
  'el-diablito',
  'el-borracho',
  'el-cazo',
  'el-gorrito',
];

export const NAME_OF: Record<string, string> = {
  'el-alacran': 'El Alacrán',
  'el-arbol': 'El Árbol',
  'el-arpa': 'El Arpa',
  'el-bandolon': 'El Bandolón',
  'el-barril': 'El Barril',
  'el-camaron': 'El Camarón',
  'el-cantarito': 'El Cantarito',
  'el-catrin': 'El Catrín',
  'el-corazon': 'El Corazón',
  'el-cotorro': 'El Cotorro',
  'el-gallo': 'El Gallo',
  'el-melon': 'El Melón',
  'el-mundo': 'El Mundo',
  'el-musico': 'El Músico',
  'el-nopal': 'El Nopal',
  'el-pajaro': 'El Pájaro',
  'el-diablito': 'El Diablito',
  'el-borracho': 'El Borracho',
  'el-cazo': 'El Cazo',
  'el-gorrito': 'El Gorrito',
};

export const imageFor = (slug: string) => `/default-cards/${slug}.webp`;

const NICKS = [
  'Ana',
  'Beto',
  'Caro',
  'Diego',
  'Elena',
  'Fer',
  'Gaby',
  'Hugo',
  'Isa',
  'Javi',
  'Lupe',
  'Memo',
];

/** Deterministic pseudo-random so the prototype looks the same every reload. */
function seeded(n: number) {
  let x = n * 9301 + 49297;
  return () => (x = (x * 9301 + 49297) % 233280) / 233280;
}

export type FakePlayer = {
  id: string;
  nickname: string;
  online: boolean;
  /** 16 card slugs, position i is grid cell i. */
  board: string[];
  /** Cell indices this Player has Marked. */
  marked: number[];
  oneAway: boolean;
};

export const PLAYERS: FakePlayer[] = NICKS.map((nickname, i) => {
  const rnd = seeded(i + 3);
  const shuffled = [...CARD_SLUGS].sort(() => rnd() - 0.5).slice(0, 16);
  const markCount = 4 + Math.floor(rnd() * 7);
  const marked = Array.from({ length: 16 }, (_, c) => c)
    .sort(() => rnd() - 0.5)
    .slice(0, markCount);
  return {
    id: `p${i}`,
    nickname,
    online: i !== 4 && i !== 9,
    board: shuffled,
    marked,
    oneAway: i === 0 || i === 6 || i === 10,
  };
});

/** Newest first. */
export const CALLS = [
  'el-cotorro',
  'el-nopal',
  'el-barril',
  'el-arpa',
  'el-catrin',
  'el-gallo',
  'el-melon',
  'el-camaron',
  'el-mundo',
  'el-corazon',
  'el-arbol',
  'el-alacran',
];

export const GAME = {
  code: '482913',
  joinUrl: 'loteria.app/play/482913',
  setName: 'Boda de Ana y Luis',
  patternLabel: 'Any row',
  autoAdvanceSeconds: 6 as number | null,
  joinsLocked: false,
  deckRemaining: 42,
};

export const WINNER = PLAYERS[6];
