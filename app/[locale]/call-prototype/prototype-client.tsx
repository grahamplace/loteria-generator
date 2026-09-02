'use client';

/** PROTOTYPE — shell. Variant is a URL param; phase is local state so all three
 *  Game phases can be walked without reloading. */
import { useState } from 'react';
import { PrototypeSwitcher } from '@/components/prototype-switcher';
import type { Phase } from './fake-call';
import { VariantA } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';

const NAMES = { A: 'Stage (TV)', B: 'Console (desktop)', C: 'Phone remote' };
const PHASES: Phase[] = ['lobby', 'playing', 'claim-window'];

export function PrototypeClient({ variant }: { variant: string }) {
  const [phase, setPhase] = useState<Phase>('playing');

  return (
    <>
      {variant === 'B' ? (
        <VariantB phase={phase} />
      ) : variant === 'C' ? (
        <VariantC phase={phase} />
      ) : (
        <VariantA phase={phase} />
      )}
      <PrototypeSwitcher
        variants={['A', 'B', 'C']}
        current={variant}
        names={NAMES}
        extra={
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as Phase)}
            aria-label="Game phase"
            className="rounded bg-neutral-800 px-1.5 py-1 text-xs text-white"
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        }
      />
    </>
  );
}
