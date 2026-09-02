'use client';

/**
 * The client half of the event protocol. See
 * docs/adr/0002-live-game-event-protocol.md.
 *
 * One snapshot on connect, deltas after, and a Game version on everything all
 * clients see. The version is why this hook is not just "apply whatever
 * arrives": a snapshot built at v47 can land *after* a v48 event, and applying
 * it would quietly roll the board back. So events at or below the snapshot's
 * version are dropped, and a gap forward triggers a resync rather than a guess.
 *
 * Marks are the documented exception — Caller-only and unversioned — so they
 * are applied without touching the sequence.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export type GameState = {
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  pattern: string;
  joinsLocked: boolean;
  autoAdvanceSeconds: number | null;
  nextCallDueAt: string | null;
  claimWindowClosesAt: string | null;
  calls: string[];
  calledCount: number;
  deckRemaining: number;
  playerCount: number;
  winnerIds: string[];
};

export type RosterEntry = { playerId: string; nickname: string; online: boolean };
export type BoardView = {
  playerId: string;
  nickname: string;
  boardCardIds: string[];
  markedCardIds: string[];
};

export type Snapshot = {
  version: number;
  serverNow: string;
  game: GameState;
  roster: RosterEntry[];
  oneAwayPlayerIds: string[];
  you?: {
    playerId: string;
    nickname: string;
    boardCardIds: string[];
    markedCardIds: string[];
  } | null;
  boards?: BoardView[];
};

export type ClaimFeedback =
  | { kind: 'rejected'; reason: 'not_all_called' | 'not_all_marked' }
  | { kind: 'won' }
  | null;

type Options = {
  url: string;
  /** Re-minted by the server action; a ticket lives ~60s so reconnects need a fresh one. */
  getTicket: () => Promise<string | null>;
};

export function useGameSocket({ url, getTicket }: Options) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [claim, setClaim] = useState<ClaimFeedback>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const versionRef = useRef(-1);
  const attemptRef = useRef(0);
  const closedByUs = useRef(false);

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  /** Apply one delta. Returns false when the caller should resync instead. */
  const apply = useCallback((msg: Record<string, unknown>): boolean => {
    const type = msg.type as string;

    if (type === 'snapshot') {
      const snap = msg as unknown as Snapshot;
      versionRef.current = snap.version;
      setSnapshot(snap);
      return true;
    }

    // Unversioned by design: Marks reach the Caller only, and counting them in
    // the sequence would make every Player think it had missed messages.
    if (type === 'marks_changed') {
      setSnapshot((prev) => {
        if (!prev?.boards) return prev;
        const { playerId, cardId, marked } = msg as {
          playerId: string;
          cardId: string;
          marked: boolean;
        };
        return {
          ...prev,
          boards: prev.boards.map((b) =>
            b.playerId !== playerId
              ? b
              : {
                  ...b,
                  markedCardIds: marked
                    ? [...new Set([...b.markedCardIds, cardId])]
                    : b.markedCardIds.filter((c) => c !== cardId),
                }
          ),
        };
      });
      return true;
    }

    if (type === 'claim_rejected') {
      setClaim({ kind: 'rejected', reason: msg.reason as 'not_all_called' | 'not_all_marked' });
      return true;
    }
    if (type === 'error') return true;
    if (type === 'server_restarting') return true;

    const version = msg.version as number | undefined;
    if (typeof version !== 'number') return true;

    // Older than what we already have: a snapshot raced an event and lost.
    if (version <= versionRef.current) return true;
    // Newer than the next one: something was missed. Guessing would render a
    // board that is wrong with nothing to detect it by.
    if (version > versionRef.current + 1) return false;

    versionRef.current = version;

    setSnapshot((prev) => {
      if (!prev) return prev;
      const next: Snapshot = { ...prev, version, game: { ...prev.game } };

      switch (type) {
        case 'call_made': {
          next.game.calls = [...prev.game.calls, msg.cardId as string];
          next.game.calledCount = msg.calledCount as number;
          next.game.deckRemaining = msg.deckRemaining as number;
          next.game.playerCount = msg.playerCount as number;
          next.game.nextCallDueAt = (msg.nextCallDueAt as string | null) ?? null;
          next.oneAwayPlayerIds = msg.oneAwayPlayerIds as string[];
          break;
        }
        case 'game_started':
          next.game.status = 'playing';
          next.game.nextCallDueAt = (msg.nextCallDueAt as string | null) ?? null;
          break;
        case 'claim_window_opened':
          next.game.nextCallDueAt = null;
          next.game.claimWindowClosesAt = (msg.closesAt as string | null) ?? null;
          break;
        case 'win_recorded':
          next.game.winnerIds = [...prev.game.winnerIds, msg.playerId as string];
          if (msg.playerId === prev.you?.playerId) setClaim({ kind: 'won' });
          break;
        case 'game_ended':
          next.game.status = 'ended';
          next.game.claimWindowClosesAt = null;
          next.game.winnerIds = msg.winnerIds as string[];
          break;
        case 'player_presence_changed':
          next.roster = prev.roster.map((r) =>
            r.playerId === msg.playerId ? { ...r, online: msg.online as boolean } : r
          );
          break;
        case 'player_renamed':
          next.roster = prev.roster.map((r) =>
            r.playerId === msg.playerId ? { ...r, nickname: msg.nickname as string } : r
          );
          break;
        case 'joins_locked_changed':
          next.game.joinsLocked = msg.locked as boolean;
          break;
        case 'auto_advance_changed':
          next.game.autoAdvanceSeconds = msg.autoAdvanceSeconds as number | null;
          next.game.nextCallDueAt = (msg.nextCallDueAt as string | null) ?? null;
          break;
      }
      return next;
    });

    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      if (cancelled) return;
      const ticket = await getTicket();
      if (cancelled) return;
      if (!ticket) {
        setStatus('closed');
        return;
      }

      const ws = new WebSocket(`${url}?ticket=${encodeURIComponent(ticket)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        setStatus('open');
      };

      ws.onmessage = (e) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (!apply(msg)) send({ type: 'resync' });
      };

      ws.onclose = () => {
        if (cancelled || closedByUs.current) return;
        setStatus('reconnecting');
        // Backoff, capped: a Caller who steps out for ten minutes should not
        // come back to a client that has given up, but nor should fifty phones
        // hammer a restarting server.
        const delay = Math.min(15_000, 500 * 2 ** attemptRef.current++);
        retry = setTimeout(connect, delay + Math.random() * 300);
      };

      ws.onerror = () => ws.close();
    };

    void connect();

    return () => {
      cancelled = true;
      closedByUs.current = true;
      if (retry) clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [url, getTicket, apply, send]);

  return { status, snapshot, claim, clearClaim: () => setClaim(null), send };
}
