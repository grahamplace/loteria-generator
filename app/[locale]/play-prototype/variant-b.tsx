'use client';

/** PROTOTYPE — Variant B: "Split". The Called card is the hero, mirroring
 *  PlayLoteria's caller column. Board shrinks to fit underneath; ¡Lotería! is a
 *  floating action button rather than a bar. */
import Image from 'next/image';
import { BOARD, GAME, RECENT_CALLS, imageFor, type VariantProps } from './fake-game';
import { ClaimMessage } from './variant-a';

export function VariantB({ marked, onToggle, onClaim, claimState }: VariantProps) {
  return (
    <div className="min-h-dvh bg-background pb-24">
      <section className="flex items-center gap-3 bg-card px-4 py-3">
        <Image
          src={imageFor(GAME.lastCalled)}
          alt=""
          width={110}
          height={165}
          className="w-24 rounded-lg border border-border shadow-sm"
          priority
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Now calling</p>
          <p className="truncate text-2xl leading-tight font-bold text-foreground">
            {GAME.lastCalled.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Before that: {RECENT_CALLS.slice(1, 4).join(' · ')}
          </p>
          <p className="mt-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
            {GAME.patternLabel}
          </p>
        </div>
      </section>

      <dl className="grid grid-cols-3 divide-x divide-border border-y border-border bg-card text-center">
        <Stat label="Called" value={`${GAME.calledCount}`} />
        <Stat label="Players" value={`${GAME.playerCount}`} sub={`${GAME.offlineCount} offline`} />
        <Stat label="One away" value={`${GAME.oneAwayCount}`} />
      </dl>

      <div className="grid grid-cols-4 gap-1.5 p-2">
        {BOARD.map((card, cell) => {
          const isMarked = marked.has(cell);
          return (
            <button
              key={card.id}
              onClick={() => onToggle(cell)}
              aria-pressed={isMarked}
              aria-label={`${card.name}${isMarked ? ', marked' : ''}`}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              className="relative aspect-square overflow-hidden rounded-lg border border-border bg-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <Image
                src={imageFor(card)}
                alt=""
                fill
                sizes="25vw"
                className={`object-cover ${isMarked ? 'opacity-35 grayscale' : ''}`}
              />
              {isMarked && (
                <span
                  aria-hidden
                  className="absolute inset-0 m-auto h-7 w-7 rounded-full bg-primary shadow"
                />
              )}
            </button>
          );
        })}
        <p className="col-span-4 px-1 pt-1 text-center text-[11px] text-muted-foreground">
          Tile names are dropped here to keep the grid square — worth testing against unfamiliar
          custom art.
        </p>
      </div>

      <div className="fixed right-4 bottom-20 left-4">
        <ClaimMessage claimState={claimState} />
      </div>
      <button
        onClick={onClaim}
        disabled={claimState === 'pending'}
        style={{ touchAction: 'manipulation' }}
        className="fixed right-4 bottom-4 h-16 rounded-full bg-primary px-6 text-base font-bold whitespace-nowrap text-primary-foreground shadow-lg disabled:opacity-60"
      >
        {claimState === 'pending' ? 'Checking…' : '¡Lotería!'}
      </button>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-2 py-2">
      <dd className="text-xl leading-none font-bold text-foreground tabular-nums">{value}</dd>
      <dt className="mt-1 text-[11px] text-muted-foreground">{label}</dt>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
