'use client';

/** PROTOTYPE — Variant C: "Phone remote". One thumb-reachable column. Assumes
 *  the Caller is walking the room with their phone; Draw sits at the bottom
 *  where the thumb is. Players and history live behind tabs, not on screen. */
import { useState } from 'react';
import Image from 'next/image';
import { CALLS, GAME, NAME_OF, PLAYERS, WINNER, imageFor, type Phase } from './fake-call';
import { MiniBoard } from './mini-board';

export function VariantC({ phase }: { phase: Phase }) {
  const [tab, setTab] = useState<'card' | 'players' | 'history'>('card');
  const current = CALLS[0];
  const online = PLAYERS.filter((p) => p.online).length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background pb-40">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <div>
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Code</p>
          <p className="text-xl leading-none font-black text-primary tabular-nums">{GAME.code}</p>
        </div>
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {online}/{PLAYERS.length} online
          <br />
          {GAME.deckRemaining} cards left
        </p>
      </header>

      {phase === 'claim-window' && (
        <div className="m-3 rounded-xl bg-accent p-3 text-accent-foreground">
          <p className="font-bold">¡Lotería! — {WINNER.nickname}</p>
          <p className="text-xs opacity-90">Calls paused. Later claims still count.</p>
        </div>
      )}

      <nav className="flex border-b border-border" role="tablist">
        {(['card', 'players', 'history'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize ${
              tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="flex-1 p-3">
        {tab === 'card' &&
          (phase === 'lobby' ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">Players joined</p>
              <p className="my-2 text-6xl font-black text-foreground tabular-nums">
                {PLAYERS.length}
              </p>
              <p className="text-sm text-muted-foreground">{GAME.joinUrl}</p>
            </div>
          ) : (
            <div className="text-center">
              <Image
                src={imageFor(current)}
                alt=""
                width={260}
                height={390}
                className="mx-auto w-48 rounded-xl border border-border shadow"
                priority
              />
              <p className="mt-3 text-3xl font-black text-foreground">{NAME_OF[current]}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {GAME.patternLabel} · {PLAYERS.filter((p) => p.oneAway).length} one away
              </p>
            </div>
          ))}

        {tab === 'players' && (
          <ul className="space-y-2">
            {PLAYERS.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-lg border border-border p-2 ${
                  p.online ? '' : 'opacity-45'
                }`}
              >
                <MiniBoard board={p.board} marked={p.marked} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.nickname}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.online ? `${p.marked.length} marked` : 'offline'}
                    {p.oneAway && ' · one away'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === 'history' && (
          <ol className="space-y-1.5">
            {CALLS.map((slug, i) => (
              <li key={slug} className="flex items-center gap-3">
                <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">
                  {CALLS.length - i}
                </span>
                <Image
                  src={imageFor(slug)}
                  alt=""
                  width={28}
                  height={42}
                  className="h-10 w-auto rounded border border-border"
                />
                <span className="text-sm text-foreground">{NAME_OF[slug]}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        {phase === 'claim-window' ? (
          <button className="h-16 w-full rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
            End game
          </button>
        ) : phase === 'lobby' ? (
          <button className="h-16 w-full rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
            Start game
          </button>
        ) : (
          <>
            <button className="h-16 w-full rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
              Draw next
            </button>
            <p className="mt-1.5 text-center text-xs text-muted-foreground tabular-nums">
              auto in 4s · every {GAME.autoAdvanceSeconds}s · tap to override
            </p>
          </>
        )}
      </div>
    </div>
  );
}
