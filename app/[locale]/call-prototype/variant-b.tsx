'use client';

/** PROTOTYPE — Variant B: "Console". Operator dashboard. Two columns: draw
 *  controls left, the live player tray right. Boards are permanently visible —
 *  the thing ticket 06 praised in both surveyed Lotería products. */
import Image from 'next/image';
import { CALLS, GAME, NAME_OF, PLAYERS, WINNER, imageFor, type Phase } from './fake-call';
import { MiniBoard } from './mini-board';

export function VariantB({ phase }: { phase: Phase }) {
  const current = CALLS[0];
  const online = PLAYERS.filter((p) => p.online).length;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="flex flex-wrap items-center gap-4 border-b border-border bg-card px-5 py-3">
        <div>
          <p className="text-xs text-muted-foreground">{GAME.setName}</p>
          <p className="text-xl font-bold text-foreground">{GAME.patternLabel}</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Game code</p>
            <p className="text-3xl leading-none font-black text-primary tabular-nums">
              {GAME.code}
            </p>
          </div>
          <div className="grid h-16 w-16 place-items-center rounded-lg border border-border bg-background text-[9px] text-muted-foreground">
            QR
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" defaultChecked={GAME.joinsLocked} className="h-4 w-4" />
            Lock joins
          </label>
        </div>
      </header>

      {phase === 'claim-window' && (
        <div className="flex flex-wrap items-center gap-3 bg-accent px-5 py-3 text-accent-foreground">
          <p className="text-lg font-bold">¡Lotería! — {WINNER.nickname} wins</p>
          <p className="text-sm opacity-90">Calls paused. Later claims still count.</p>
          <button className="ml-auto h-11 rounded-lg bg-primary px-6 font-bold text-primary-foreground">
            End game
          </button>
        </div>
      )}

      <div className="grid gap-5 p-5 lg:grid-cols-[320px_1fr]">
        <section className="space-y-4">
          {phase === 'lobby' ? (
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="text-sm text-muted-foreground">Waiting for players</p>
              <p className="my-3 text-5xl font-black text-foreground tabular-nums">
                {PLAYERS.length}
              </p>
              <button className="h-14 w-full rounded-xl bg-primary text-lg font-bold text-primary-foreground">
                Start game
              </button>
            </div>
          ) : (
            <>
              <Image
                src={imageFor(current)}
                alt=""
                width={320}
                height={480}
                className="w-full rounded-xl border border-border shadow"
                priority
              />
              <p className="text-center text-3xl font-black text-foreground">{NAME_OF[current]}</p>
              <button
                disabled={phase === 'claim-window'}
                className="h-14 w-full rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
              >
                Draw next
              </button>
              <div className="rounded-lg border border-border p-3 text-sm">
                <label className="flex items-center justify-between">
                  Auto-advance
                  <select
                    defaultValue={String(GAME.autoAdvanceSeconds)}
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <option value="null">Manual</option>
                    <option value="4">4s</option>
                    <option value="6">6s</option>
                    <option value="8">8s</option>
                  </select>
                </label>
              </div>
              <div>
                <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
                  Called ({CALLS.length})
                </p>
                <ol className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {CALLS.map((slug, i) => (
                    <li key={slug} className="flex justify-between text-foreground">
                      <span>{NAME_OF[slug]}</span>
                      <span className="text-muted-foreground tabular-nums">{CALLS.length - i}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm text-muted-foreground tabular-nums">
            {online} online · {PLAYERS.length - online} offline ·{' '}
            {PLAYERS.filter((p) => p.oneAway).length} one away
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {PLAYERS.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg border p-2 ${
                  p.oneAway ? 'border-secondary bg-secondary/15' : 'border-border bg-card'
                } ${p.online ? '' : 'opacity-45'}`}
              >
                <MiniBoard board={p.board} marked={p.marked} size="md" />
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-foreground">
                  {p.nickname}
                  {!p.online && <span className="text-muted-foreground">· offline</span>}
                </p>
                {p.oneAway && (
                  <p className="text-[10px] font-semibold text-secondary-foreground">One away</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
