'use client';

/** PROTOTYPE — Variant C: "Full-bleed board + pull-up sheet". The Board owns the
 *  whole screen; every other fact is on demand. Tests whether a Player actually
 *  needs the stats visible, or only when they go looking. */
import { useState } from 'react';
import Image from 'next/image';
import { BOARD, GAME, RECENT_CALLS, imageFor, type VariantProps } from './fake-game';
import { ClaimMessage } from './variant-a';

export function VariantC({ marked, onToggle, onClaim, claimState }: VariantProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="grid h-dvh grid-cols-4 grid-rows-4 gap-px bg-border pb-32">
        {BOARD.map((card, cell) => {
          const isMarked = marked.has(cell);
          return (
            <button
              key={card.id}
              onClick={() => onToggle(cell)}
              aria-pressed={isMarked}
              aria-label={`${card.name}${isMarked ? ', marked' : ''}`}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              className="relative overflow-hidden bg-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-inset"
            >
              <Image src={imageFor(card)} alt="" fill sizes="25vw" className="object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 pt-3 pb-0.5 text-center text-[9px] leading-tight font-semibold text-white">
                {card.name}
              </span>
              {isMarked && (
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center bg-background/65"
                >
                  <span className="h-10 w-10 rounded-full bg-primary shadow-md ring-2 ring-primary-foreground/70" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.18)] transition-transform duration-200 motion-reduce:transition-none ${
          open ? 'translate-y-0' : 'translate-y-[calc(100%-8.5rem)]'
        }`}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Hide game details' : 'Show game details'}
          className="flex h-8 w-full items-center justify-center"
          style={{ touchAction: 'manipulation' }}
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
        </button>

        <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <ClaimMessage claimState={claimState} />
          <button
            onClick={onClaim}
            disabled={claimState === 'pending'}
            style={{ touchAction: 'manipulation' }}
            className="h-14 w-full rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
          >
            {claimState === 'pending' ? 'Checking…' : '¡Lotería!'}
          </button>

          <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
            <Image
              src={imageFor(GAME.lastCalled)}
              alt=""
              width={48}
              height={72}
              className="h-14 w-auto rounded border border-border"
            />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase">Last called</p>
              <p className="truncate text-base font-bold text-foreground">{GAME.lastCalled.name}</p>
            </div>
            <p className="ml-auto text-right text-xs text-muted-foreground tabular-nums">
              {GAME.calledCount} called
              <br />
              {GAME.playerCount} players
            </p>
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs font-semibold text-foreground">
              {GAME.patternLabel} · {GAME.oneAwayCount} players one away
            </p>
            <p className="mt-2 text-[11px] tracking-wide text-muted-foreground uppercase">
              Recent calls
            </p>
            <ol className="mt-1 flex flex-wrap gap-1">
              {RECENT_CALLS.map((n) => (
                <li
                  key={n}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground"
                >
                  {n}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
