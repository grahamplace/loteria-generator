'use client';

/** PROTOTYPE — shell holding the fake Marks state and the variant switch. */
import { useState } from 'react';
import { PrototypeSwitcher } from '@/components/prototype-switcher';
import { CALLED_CELLS, GAME, INITIAL_MARKED } from './fake-game';
import { VariantA } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';

const NAMES = {
  A: 'Board first',
  B: 'Called card hero',
  C: 'Full-bleed + sheet',
};

export function PrototypeClient({ variant }: { variant: string }) {
  const [marked, setMarked] = useState<Set<number>>(new Set(INITIAL_MARKED));
  const [claimState, setClaimState] = useState<
    'idle' | 'pending' | 'rejected-not-called' | 'rejected-not-marked' | 'won'
  >('idle');

  const onToggle = (cell: number) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(cell)) next.delete(cell);
      else next.add(cell);
      return next;
    });
    setClaimState('idle');
  };

  /** Stands in for the server: a Win needs every cell of one Pattern instance
   *  both Called and Marked (ticket 07). Rejection says which of the two failed. */
  const onClaim = () => {
    setClaimState('pending');
    setTimeout(() => {
      const anyAllCalled = GAME.patternInstances.some((cells) =>
        cells.every((c) => CALLED_CELLS.has(c))
      );
      const anyWin = GAME.patternInstances.some((cells) =>
        cells.every((c) => CALLED_CELLS.has(c) && marked.has(c))
      );
      setClaimState(anyWin ? 'won' : anyAllCalled ? 'rejected-not-marked' : 'rejected-not-called');
    }, 450);
  };

  const props = { marked, onToggle, onClaim, claimState };

  return (
    <>
      {variant === 'B' ? (
        <VariantB {...props} />
      ) : variant === 'C' ? (
        <VariantC {...props} />
      ) : (
        <VariantA {...props} />
      )}
      <PrototypeSwitcher variants={['A', 'B', 'C']} current={variant} names={NAMES} />
    </>
  );
}
