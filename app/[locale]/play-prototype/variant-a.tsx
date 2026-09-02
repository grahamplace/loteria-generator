'use client';

/** PROTOTYPE — Variant A: "Board first". Chrome squeezed to a slim strip so the
 *  4×4 grid is as big as the phone allows. Last Called rides as a corner chip. */
import Image from 'next/image';
import { BOARD, GAME, imageFor, type VariantProps } from './fake-game';

export function VariantA({ marked, onToggle, onClaim, claimState }: VariantProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pb-24">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{GAME.patternLabel}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {GAME.calledCount} called · {GAME.playerCount} players · {GAME.oneAwayCount} one away
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card p-1 pr-2">
          <Image
            src={imageFor(GAME.lastCalled)}
            alt=""
            width={40}
            height={60}
            className="h-10 w-auto rounded"
          />
          <div className="text-right">
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Last called</p>
            <p className="text-xs font-semibold text-foreground">{GAME.lastCalled.name}</p>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-4 gap-1 p-1">
        {BOARD.map((card, cell) => {
          const isMarked = marked.has(cell);
          return (
            <button
              key={card.id}
              onClick={() => onToggle(cell)}
              aria-pressed={isMarked}
              aria-label={`${card.name}${isMarked ? ', marked' : ''}`}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              className="relative flex aspect-2/3 flex-col overflow-hidden rounded-md border border-border bg-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <Image
                src={imageFor(card)}
                alt=""
                fill
                sizes="25vw"
                className={`object-cover transition-opacity ${isMarked ? 'opacity-40' : 'opacity-100'}`}
              />
              <span className="relative mt-auto w-full bg-card/90 px-0.5 py-0.5 text-center text-[9px] leading-tight font-medium text-foreground">
                {card.name}
              </span>
              {isMarked && (
                <span
                  aria-hidden
                  className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-primary/85 ring-2 ring-primary-foreground/50"
                />
              )}
            </button>
          );
        })}
      </div>

      <ClaimBar onClaim={onClaim} claimState={claimState} />
    </div>
  );
}

function ClaimBar({ onClaim, claimState }: Pick<VariantProps, 'onClaim' | 'claimState'>) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      <ClaimMessage claimState={claimState} />
      <button
        onClick={onClaim}
        disabled={claimState === 'pending'}
        style={{ touchAction: 'manipulation' }}
        className="h-14 w-full rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
      >
        {claimState === 'pending' ? 'Checking…' : '¡Lotería!'}
      </button>
    </div>
  );
}

export function ClaimMessage({ claimState }: Pick<VariantProps, 'claimState'>) {
  if (claimState === 'idle' || claimState === 'pending') return null;
  const text =
    claimState === 'won'
      ? '¡Lotería! You won.'
      : claimState === 'rejected-not-called'
        ? "Not yet — those cards haven't all been called."
        : "Not yet — you haven't marked every card in the pattern.";
  return (
    <p
      aria-live="polite"
      className={`mb-2 rounded-lg px-3 py-2 text-center text-sm font-medium ${
        claimState === 'won'
          ? 'bg-accent text-accent-foreground'
          : 'bg-secondary text-secondary-foreground'
      }`}
    >
      {text}
    </p>
  );
}
