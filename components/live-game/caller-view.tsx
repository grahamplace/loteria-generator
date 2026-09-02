'use client';

/**
 * The Caller's screen — one responsive view, two layouts (ticket 09).
 *
 * At large widths it is Variant A, "Stage": built to be cast to a TV, card
 * enormous, Code prominent, controls in a thin bar. At phone widths it becomes
 * Variant C, "Phone remote": Draw at thumb height. A Caller can hold both at
 * once, laptop on the TV and phone in hand, because every connection is an
 * equal view of one identity.
 *
 * Player Boards are behind a toggle and OFF by default. Not squeamishness: a
 * cast screen is a public screen, so a permanently visible tray shows every
 * Player's Board to the whole room.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { getCallerTicket } from '@/app/actions/live-game';
import { useGameSocket } from './use-game-socket';
import type { CardMeta } from './player-board';

export function CallerView({ code, setName }: { code: string; setName: string }) {
  const t = useTranslations('LiveGame.caller');
  const tp = useTranslations('LiveGame.patterns');
  const [cards, setCards] = useState<Record<string, CardMeta>>({});
  const [showBoards, setShowBoards] = useState(false);

  const getTicket = useCallback(async () => {
    const r = await getCallerTicket(code);
    return r.ok ? r.ticket : null;
  }, [code]);

  const { status, snapshot, send } = useGameSocket({
    url: process.env.NEXT_PUBLIC_WS_URL!,
    getTicket,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/live-game/${code}/cards`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((d) => !cancelled && setCards(d.cards))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);

  const game = snapshot?.game;
  const meta = (id: string): CardMeta => cards[id] ?? { id, label: '', src: '' };
  const current = game?.calls.at(-1);
  const online = snapshot?.roster.filter((r) => r.online).length ?? 0;
  const winner = snapshot?.roster.find((r) => r.playerId === game?.winnerIds[0]);
  const frozen = (game?.winnerIds.length ?? 0) > 0;

  if (!game) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background">
        <p className="text-muted-foreground">{status === 'open' ? '…' : status}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background pb-4">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{setName}</p>
          <p className="text-lg font-bold text-foreground">{tp(game.pattern as never)}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
            {t('joinAt')} /play/{code}
          </p>
          <p className="text-3xl leading-none font-black text-primary tabular-nums sm:text-5xl">
            {code}
          </p>
        </div>
      </header>

      {frozen && winner && (
        <div className="m-3 rounded-xl bg-accent px-4 py-3 text-accent-foreground">
          <p className="text-xl font-bold">{t('claimWindow', { nickname: winner.nickname })}</p>
          <p className="text-sm opacity-90">{t('claimWindowHint')}</p>
        </div>
      )}

      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-4 sm:flex-row sm:gap-10">
        {game.status === 'lobby' ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('waitingForPlayers')}</p>
            <p className="my-2 text-6xl font-black text-foreground tabular-nums">
              {snapshot.roster.length}
            </p>
          </div>
        ) : current ? (
          <>
            {meta(current).src && (
              <Image
                src={meta(current).src}
                alt=""
                width={420}
                height={630}
                priority
                className="w-40 rounded-2xl border border-border shadow-xl sm:w-[min(34vw,380px)]"
              />
            )}
            <div className="text-center sm:text-left">
              <p className="text-4xl leading-none font-black text-foreground sm:text-6xl">
                {meta(current).label}
              </p>
              <p className="mt-3 text-muted-foreground tabular-nums">
                {t('playersOnline', { online, total: snapshot.roster.length })} ·{' '}
                {t('cardsLeft', { count: game.deckRemaining })} ·{' '}
                {t('oneAway', { count: snapshot.oneAwayPlayerIds.length })}
              </p>
            </div>
          </>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border px-4 py-3">
        {game.status === 'lobby' ? (
          <button
            onClick={() => send({ type: 'start_game' })}
            className="h-14 rounded-xl bg-primary px-8 text-lg font-bold text-primary-foreground"
          >
            {t('start')}
          </button>
        ) : frozen || game.status === 'ended' ? (
          <button
            onClick={() => send({ type: 'end_game' })}
            disabled={game.status === 'ended'}
            className="h-14 rounded-xl bg-primary px-8 text-lg font-bold text-primary-foreground disabled:opacity-50"
          >
            {t('endGame')}
          </button>
        ) : (
          <>
            <button
              onClick={() => send({ type: 'call_next' })}
              disabled={game.deckRemaining === 0}
              className="h-14 rounded-xl bg-primary px-8 text-lg font-bold text-primary-foreground disabled:opacity-50"
            >
              {t('drawNext')}
            </button>
            <select
              value={game.autoAdvanceSeconds ?? 'manual'}
              onChange={(e) =>
                send({
                  type: 'set_auto_advance',
                  seconds: e.target.value === 'manual' ? null : Number(e.target.value),
                })
              }
              aria-label={t('manual')}
              className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="manual">{t('manual')}</option>
              {[4, 6, 8].map((s) => (
                <option key={s} value={s}>
                  {t('everySeconds', { seconds: s })}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={game.joinsLocked}
                onChange={(e) => send({ type: 'lock_joins', locked: e.target.checked })}
                className="h-4 w-4"
              />
              {t('lockJoins')}
            </label>
          </>
        )}

        <button
          onClick={() => setShowBoards((v) => !v)}
          aria-expanded={showBoards}
          className="ml-auto h-11 rounded-lg border border-border px-4 text-sm text-foreground"
        >
          {showBoards ? t('hideBoards') : t('showBoards')}
        </button>
      </div>

      {showBoards ? (
        <div className="flex flex-wrap gap-4 border-t border-border px-4 py-4">
          {(snapshot.boards ?? []).map((b) => {
            const marked = new Set(b.markedCardIds);
            const oneAway = snapshot.oneAwayPlayerIds.includes(b.playerId);
            const isOnline = snapshot.roster.find((r) => r.playerId === b.playerId)?.online;
            return (
              <div
                key={b.playerId}
                className={`rounded-lg border p-2 ${oneAway ? 'border-secondary bg-secondary/15' : 'border-border'} ${isOnline ? '' : 'opacity-45'}`}
              >
                <div className="grid w-24 grid-cols-4 gap-px">
                  {b.boardCardIds.map((cardId, cell) => (
                    <div key={cell} className="relative aspect-2/3 overflow-hidden bg-muted">
                      {meta(cardId).src && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={meta(cardId).src}
                          alt=""
                          className={`h-full w-full object-cover ${marked.has(cardId) ? 'opacity-30' : ''}`}
                        />
                      )}
                      {marked.has(cardId) && (
                        <span
                          aria-hidden
                          className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-primary"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs font-medium text-foreground">{b.nickname}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="px-4 pb-2 text-center text-xs text-muted-foreground">{t('castWarning')}</p>
      )}
    </main>
  );
}
