'use client';

/** PROTOTYPE — Variant A: "Stage". Built to be cast to a TV everyone in the
 *  room can see. The card is enormous; controls are small and out of the way;
 *  player Boards are hidden behind a toggle because nobody watching wants them. */
import { useState } from 'react';
import Image from 'next/image';
import { CALLS, GAME, NAME_OF, PLAYERS, WINNER, imageFor, type Phase } from './fake-call';
import { MiniBoard } from './mini-board';

export function VariantA({ phase }: { phase: Phase }) {
  const [showBoards, setShowBoards] = useState(false);
  const current = CALLS[0];
  const online = PLAYERS.filter((p) => p.online).length;

  if (phase === 'lobby') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-8 pb-24">
        <p className="text-sm tracking-widest text-muted-foreground uppercase">Join at</p>
        <p className="text-3xl font-semibold text-foreground">{GAME.joinUrl}</p>
        <p className="text-[9rem] leading-none font-black tracking-tight text-primary tabular-nums">
          {GAME.code}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {PLAYERS.map((p) => (
            <span
              key={p.id}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-lg text-foreground"
            >
              {p.nickname}
            </span>
          ))}
        </div>
        <p className="text-muted-foreground tabular-nums">
          {PLAYERS.length} of 50 · {GAME.patternLabel}
        </p>
        <button className="h-16 rounded-xl bg-primary px-10 text-xl font-bold text-primary-foreground">
          Start game
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-24">
      <header className="flex items-center justify-between px-6 py-3">
        <p className="text-lg font-semibold text-foreground">{GAME.patternLabel}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {online}/{PLAYERS.length} online · {GAME.deckRemaining} left
        </p>
        <p className="text-2xl font-black text-primary tabular-nums">{GAME.code}</p>
      </header>

      {phase === 'claim-window' && (
        <div className="mx-6 mb-3 rounded-xl bg-accent px-6 py-4 text-accent-foreground">
          <p className="text-2xl font-bold">¡Lotería! — {WINNER.nickname} wins</p>
          <p className="text-sm opacity-90">
            Calls are paused. Anyone else who claims now also wins.
          </p>
        </div>
      )}

      <div className="flex flex-1 items-center justify-center gap-10 px-6">
        <Image
          src={imageFor(current)}
          alt=""
          width={420}
          height={630}
          className="w-[min(38vw,420px)] rounded-2xl border border-border shadow-xl"
          priority
        />
        <div>
          <p className="text-[4rem] leading-none font-black text-foreground">{NAME_OF[current]}</p>
          <p className="mt-4 text-xl text-muted-foreground">
            {PLAYERS.filter((p) => p.oneAway).length} players one away
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto border-t border-border px-6 py-3">
        {CALLS.slice(1).map((slug) => (
          <Image
            key={slug}
            src={imageFor(slug)}
            alt={NAME_OF[slug]}
            width={48}
            height={72}
            className="h-16 w-auto shrink-0 rounded border border-border opacity-70"
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-border px-6 py-3">
        {phase === 'claim-window' ? (
          <button className="h-14 rounded-xl bg-primary px-10 text-lg font-bold text-primary-foreground">
            End game
          </button>
        ) : (
          <>
            <button className="h-14 rounded-xl bg-primary px-10 text-lg font-bold text-primary-foreground">
              Draw next
            </button>
            <span className="text-sm text-muted-foreground tabular-nums">
              auto in 4s · every {GAME.autoAdvanceSeconds}s
            </span>
          </>
        )}
        <button
          onClick={() => setShowBoards((v) => !v)}
          aria-expanded={showBoards}
          className="ml-auto h-11 rounded-lg border border-border px-4 text-sm text-foreground"
        >
          {showBoards ? 'Hide boards' : 'Show boards'}
        </button>
      </div>

      {showBoards && (
        <div className="flex flex-wrap gap-4 border-t border-border px-6 py-4">
          {PLAYERS.map((p) => (
            <div key={p.id} className={p.online ? '' : 'opacity-40'}>
              <MiniBoard board={p.board} marked={p.marked} />
              <p className="mt-1 text-center text-xs text-foreground">{p.nickname}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
