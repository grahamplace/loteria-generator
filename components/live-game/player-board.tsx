'use client';

/**
 * The Player's phone view — Variant A, "Board first" (ticket 08).
 *
 * The Board is the page. Chrome is a slim strip, the last Called card is a
 * corner chip rather than a hero (the Player hears the Caller; the phone is for
 * the Board), and ¡Lotería! is a fixed bottom bar.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { joinGame, type JoinGameResult } from '@/app/actions/live-game';
import { getDeviceToken } from './device-token';
import { useGameSocket } from './use-game-socket';
import { CardTile } from './card-tile';
import { DEFAULT_CARDS_BY_ID } from '@/lib/default-cards';

type Joined = Extract<JoinGameResult, { ok: true }>;

export type CardMeta = { id: string; label: string; src: string };

export function PlayerBoard({ joined }: { joined: Joined }) {
  const t = useTranslations('LiveGame.player');
  const tp = useTranslations('LiveGame.patterns');
  const [cards, setCards] = useState<Record<string, CardMeta>>({});

  // A fresh ticket per connection: they live ~60s, so a reconnect after a
  // deploy or a tunnel cannot reuse the one that got us here.
  const getTicket = useCallback(async () => {
    const again = await joinGame(joined.gameCode, joined.nickname, getDeviceToken(joined.gameCode));
    return again.ok ? again.ticket : null;
  }, [joined.gameCode, joined.nickname]);

  const { status, snapshot, claim, clearClaim, send } = useGameSocket({
    url: process.env.NEXT_PUBLIC_WS_URL!,
    getTicket,
  });

  const you = snapshot?.you;
  const board = you?.boardCardIds ?? joined.boardCardIds;

  /**
   * Marks are held locally and applied optimistically.
   *
   * They have to be: `marks_changed` fans out to the Caller only (ADR 0002),
   * so the Player's own tap is never echoed back to them. Rendering from the
   * snapshot alone means a bean that appears only on the Caller's tray and
   * never under the finger that placed it.
   *
   * The server stays the source of truth — each snapshot reconciles, which is
   * how a reconnect on another device gets the right board back.
   */
  const [marked, setMarked] = useState<Set<string>>(() => new Set(joined.markedCardIds ?? []));
  const serverMarks = you?.markedCardIds;
  useEffect(() => {
    if (serverMarks) setMarked(new Set(serverMarks));
  }, [serverMarks]);

  const toggle = (cardId: string) => {
    const next = !marked.has(cardId);
    setMarked((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(cardId);
      else copy.delete(cardId);
      return copy;
    });
    send({ type: 'mark', cardId, marked: next });
    clearClaim();
  };

  const lastCall = snapshot?.game.calls.at(-1);
  const meta = (id: string): CardMeta => cards[id] ?? { id, label: '', src: '' };

  // Card art is not in the protocol — the wire carries ids, and the client
  // resolves them once per Game rather than per Call. In an effect, not the
  // render body: a fetch there refires on every state change, which for a board
  // that re-renders on every Call and every tap is a request storm.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/live-game/${joined.gameCode}/cards`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((data) => {
        if (!cancelled) setCards(data.cards);
      })
      .catch(() => {
        // Fall back to the shipped defaults so the Board is never blank.
        if (cancelled) return;
        setCards(
          Object.fromEntries(
            Object.values(DEFAULT_CARDS_BY_ID)
              .filter((c): c is NonNullable<typeof c> => !!c)
              .map((c) => [c.id, { id: c.id, label: c.label, src: c.src }])
          )
        );
      });
    return () => {
      cancelled = true;
    };
  }, [joined.gameCode]);

  const won = snapshot?.game.winnerIds.includes(you?.playerId ?? '') ?? false;
  const ended = snapshot?.game.status === 'ended';

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-28">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {snapshot ? tp(snapshot.game.pattern as never) : '…'}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {snapshot?.game.status === 'lobby'
              ? t('waitingToStart')
              : t('stats', {
                  called: snapshot?.game.calledCount ?? 0,
                  players: snapshot?.game.playerCount ?? 0,
                  oneAway: snapshot?.oneAwayPlayerIds.length ?? 0,
                })}
          </p>
        </div>
        {lastCall && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card p-1 pr-2">
            {meta(lastCall).src && (
              <Image
                src={meta(lastCall).src}
                alt=""
                width={40}
                height={60}
                className="h-10 w-auto rounded"
              />
            )}
            <div className="text-right">
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                {t('lastCalled')}
              </p>
              <p className="text-xs font-semibold text-foreground">{meta(lastCall).label}</p>
            </div>
          </div>
        )}
      </header>

      {status !== 'open' && (
        <p
          aria-live="polite"
          className="bg-secondary px-3 py-1 text-center text-xs text-secondary-foreground"
        >
          {t('reconnecting')}
        </p>
      )}

      <div className="grid flex-1 grid-cols-4 gap-1 p-1">
        {board.map((cardId) => (
          <CardTile
            key={cardId}
            label={meta(cardId).label}
            src={meta(cardId).src}
            marked={marked.has(cardId)}
            onToggle={() => toggle(cardId)}
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        {(claim || ended) && (
          <p
            aria-live="polite"
            className={`mb-2 rounded-lg px-3 py-2 text-center text-sm font-medium ${
              won ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {won
              ? t('youWon')
              : ended
                ? t('ended')
                : claim?.kind === 'rejected'
                  ? claim.reason === 'not_all_called'
                    ? t('rejectedNotCalled')
                    : t('rejectedNotMarked')
                  : t('won')}
          </p>
        )}
        <button
          type="button"
          onClick={() => send({ type: 'claim' })}
          disabled={ended || snapshot?.game.status !== 'playing'}
          style={{ touchAction: 'manipulation' }}
          className="h-14 w-full rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
        >
          {t('lot')}
        </button>
      </div>
    </div>
  );
}
