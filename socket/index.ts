/**
 * Live game socket server.
 *
 * ADR 0001 makes this process the sole arbiter for every Game it holds, and
 * ADR 0002 defines what crosses the wire: one role-scoped snapshot on connect,
 * then versioned deltas.
 *
 * There is no HTTP from Next.js. A Game reaches this server because a client
 * arrives holding a ticket that names its Code, and the Game is materialised
 * from Postgres on the spot.
 *
 * `GET /health` also reports what the spike measured — Neon RTT and connection
 * lifetimes — because both answers stay useful in production.
 */
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { verifyTicket } from '@/lib/live-game/ticket';
import { getGame, liveGameCount } from './game-registry';
import { callerSnapshot, playerSnapshot } from './snapshot';
import { pool } from './db';
import {
  addConn,
  broadcast,
  connCount,
  recountConnections,
  removeConn,
  send,
  type Conn,
} from './broadcast';
import {
  broadcastPresence,
  handleCallNext,
  handleClaim,
  handleEndGame,
  handleLockJoins,
  handleMark,
  handleRename,
  handleSetAutoAdvance,
  handleStartGame,
} from './commands';
import { armedCount, clearAllTimers, reschedule } from './timers';

const PORT = Number(process.env.PORT ?? 8080);
const HEARTBEAT_MS = 25_000;
const DEAD_AFTER_MISSED = 2;

const startedAt = Date.now();

// ---------------------------------------------------------------------------
// Neon
// ---------------------------------------------------------------------------

type RttSample = { at: string; ms: number };
const rttSamples: RttSample[] = [];

/**
 * The first query pays for the pool's first connection: TCP, TLS, and Neon
 * waking the compute. Locally that was 2.4s against an 89ms warm query. Kept
 * separate, because averaging it in would make the steady-state number
 * unreadable — and steady state is what every Call actually pays.
 */
let coldStartMs: number | null = null;

/** One round trip to Neon. `SELECT 1` — reads nothing, writes nothing. */
async function sampleRtt(): Promise<number | null> {
  const t0 = performance.now();
  try {
    await pool.query('SELECT 1');
    const ms = Math.round((performance.now() - t0) * 100) / 100;
    if (coldStartMs === null) {
      coldStartMs = ms;
    } else {
      rttSamples.push({ at: new Date().toISOString(), ms });
      if (rttSamples.length > 200) rttSamples.shift();
    }
    return ms;
  } catch (err) {
    console.error('[rtt] failed', (err as Error).message);
    return null;
  }
}

function rttStats() {
  if (rttSamples.length === 0) return null;
  const ms = rttSamples.map((s) => s.ms).sort((a, b) => a - b);
  const at = (p: number) => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))];
  return {
    samples: ms.length,
    min: ms[0],
    p50: at(0.5),
    p95: at(0.95),
    max: ms[ms.length - 1],
  };
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

type Closed = {
  id: number;
  /** How long it stayed open. The number question 1 turns on. */
  heldForSeconds: number;
  /** Seconds of silence before it closed — ignoring our own heartbeat. */
  idleForSeconds: number;
  code: number;
  reason: string;
  closedAt: string;
};

const closed: Closed[] = [];

const httpServer = createServer((req, res) => {
  if (req.url?.startsWith('/health')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify(
        {
          ok: true,
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
          region: process.env.FLY_REGION ?? 'local',
          machine: process.env.FLY_MACHINE_ID ?? null,
          liveGames: liveGameCount(),
          connections: connCount(),
          armedTimers: armedCount(),
          neonColdStartMs: coldStartMs,
          neonRttMs: rttStats(),
          liveConnections: [...live.values()].map((c) => ({
            id: c.id,
            heldForSeconds: Math.round((Date.now() - c.openedAt) / 1000),
            idleForSeconds: Math.round((Date.now() - c.lastTrafficAt) / 1000),
          })),
          // The evidence for question 1. An empty list after a long idle hold
          // is the good outcome.
          recentlyClosed: closed.slice(-25),
        },
        null,
        2
      )
    );
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server: httpServer });

/** Live connections, keyed by socket, for the heartbeat and /health. */
const live = new Map<WebSocket, Conn>();
let nextId = 1;

/** Commands only the Caller may send. A Player sending one gets an error, not silence. */
const CALLER_ONLY = new Set([
  'start_game',
  'call_next',
  'set_auto_advance',
  'lock_joins',
  'end_game',
]);

wss.on('connection', (ws, req) => {
  const id = nextId++;
  const now = Date.now();

  /**
   * Listeners are attached SYNCHRONOUSLY, before any await.
   *
   * Setting the Game up means rehydrating from Postgres, and a client that
   * sends a command the instant the socket opens — a `resync`, say — would
   * arrive during that gap. `ws` emits to whoever is listening at the time and
   * drops the message otherwise, so the command would vanish with no error at
   * either end. Buffer until ready, then drain in order.
   */
  const pending: string[] = [];
  let deliver = (raw: string) => {
    pending.push(raw);
  };
  ws.on('message', (raw) => deliver(raw.toString()));

  let onClose: ((code: number, reason: Buffer) => void) | null = null;
  ws.on('close', (code, reason) => onClose?.(code, reason));

  void (async () => {
    // The ticket rides in the query string because browsers cannot set headers on
    // a WebSocket upgrade, and it lives sixty seconds precisely because a URL is
    // the leakiest place to put a credential.
    const url = new URL(req.url ?? '/', 'http://localhost');
    const verified = verifyTicket(url.searchParams.get('ticket') ?? '');

    if (!verified.ok) {
      console.log(`[ws] reject #${id}: ticket ${verified.reason}`);
      ws.send(JSON.stringify({ type: 'error', code: 'bad_ticket', reason: verified.reason }));
      ws.close(1008, verified.reason);
      return;
    }

    const { gameCode, role, playerId } = verified.payload;
    const game = await getGame(gameCode);
    if (!game) {
      ws.send(JSON.stringify({ type: 'error', code: 'no_such_game' }));
      ws.close(1008, 'no_such_game');
      return;
    }
    if (role === 'player' && (!playerId || !game.players.has(playerId))) {
      // A signed ticket naming a Player this Game does not have means the row went
      // away between minting and connecting. Do not invent a seat.
      ws.send(JSON.stringify({ type: 'error', code: 'no_such_player' }));
      ws.close(1008, 'no_such_player');
      return;
    }

    const conn: Conn = {
      id,
      ws,
      gameCode,
      role,
      playerId,
      openedAt: now,
      lastTrafficAt: now,
      missedPongs: 0,
    };
    live.set(ws, conn);
    addConn(conn);
    recountConnections(game);
    console.log(`[ws] open #${id} ${role} game=${gameCode} (${live.size} live)`);

    send(conn, role === 'caller' ? callerSnapshot(game) : playerSnapshot(game, playerId!));
    if (playerId) broadcastPresence(game, playerId);
    // A Game can come back mid-flight after a deploy; boot grace keeps the
    // re-armed clock from firing into a room still reconnecting.
    reschedule(game, { boot: true });

    ws.on('pong', () => {
      conn.missedPongs = 0;
    });

    const handleMessage = async (raw: string) => {
      conn.lastTrafficAt = Date.now();

      let msg: { type?: string; [k: string]: unknown };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(conn, { type: 'error', code: 'malformed' });
        return;
      }

      const current = await getGame(gameCode);
      if (!current) {
        send(conn, { type: 'error', code: 'no_such_game' });
        return;
      }

      if (msg.type && CALLER_ONLY.has(msg.type) && role !== 'caller') {
        send(conn, { type: 'error', code: 'forbidden', command: msg.type });
        return;
      }

      switch (msg.type) {
        case 'resync':
          send(
            conn,
            role === 'caller' ? callerSnapshot(current) : playerSnapshot(current, playerId!)
          );
          return;

        case 'mark':
          if (!playerId || typeof msg.cardId !== 'string') return;
          await handleMark(current, playerId, msg.cardId, msg.marked !== false);
          return;

        case 'claim':
          if (!playerId) return;
          await handleClaim(current, playerId, conn);
          reschedule(current);
          return;

        case 'rename':
          if (!playerId || typeof msg.nickname !== 'string') return;
          await handleRename(current, playerId, msg.nickname);
          return;

        case 'start_game':
          await handleStartGame(current);
          reschedule(current);
          return;

        case 'call_next':
          await handleCallNext(current);
          reschedule(current);
          return;

        case 'set_auto_advance': {
          const seconds = msg.seconds === null ? null : Number(msg.seconds);
          if (seconds !== null && (!Number.isFinite(seconds) || seconds < 2 || seconds > 60)) {
            send(conn, { type: 'error', code: 'invalid_interval' });
            return;
          }
          await handleSetAutoAdvance(current, seconds);
          reschedule(current);
          return;
        }

        case 'lock_joins':
          await handleLockJoins(current, msg.locked !== false);
          return;

        case 'end_game':
          await handleEndGame(current, 'caller_ended');
          reschedule(current);
          return;

        default:
          send(conn, { type: 'error', code: 'unknown_command', received: msg.type ?? null });
      }
    };

    // Ready: take new messages directly, then replay anything that arrived while
    // the Game was loading, in the order it was sent.
    deliver = (raw) => void handleMessage(raw);
    for (const raw of pending.splice(0)) await handleMessage(raw);

    onClose = (code, reasonBuf) => {
      closed.push({
        id: conn.id,
        heldForSeconds: Math.round((Date.now() - conn.openedAt) / 1000),
        idleForSeconds: Math.round((Date.now() - conn.lastTrafficAt) / 1000),
        code,
        reason: reasonBuf.toString() || '(none)',
        closedAt: new Date().toISOString(),
      });
      if (closed.length > 100) closed.shift();
      console.log(`[ws] close #${conn.id} code=${code} held=${closed.at(-1)!.heldForSeconds}s`);

      live.delete(ws);
      removeConn(conn);
      // Going offline is not leaving: the Player keeps their seat, their Board and
      // their Marks. Only the roster's online flag changes.
      void getGame(gameCode).then((g) => {
        if (!g) return;
        recountConnections(g);
        if (conn.playerId) broadcastPresence(g, conn.playerId);
      });
    };
  })();
});

/**
 * Heartbeat. Note this is deliberately a *protocol-level* ping — it does not
 * touch `lastTrafficAt`, so `idleForSeconds` still reports genuine application
 * silence. That distinction is the experiment: if Fly's proxy is satisfied by
 * ping frames, a quiet game survives; if it counts only application data, it
 * does not.
 */
const heartbeat = setInterval(() => {
  for (const [ws, c] of live) {
    if (c.missedPongs >= DEAD_AFTER_MISSED) {
      console.log(`[ws] terminating #${c.id}, ${c.missedPongs} missed pongs`);
      ws.terminate();
      continue;
    }
    c.missedPongs++;
    ws.ping();
  }
}, HEARTBEAT_MS);

/**
 * Background RTT sampling, so /health has data without a client asking.
 *
 * Now that the pool holds connections open, this measures what a Call actually
 * pays. It did not before: at a 10s idle timeout the connection was evicted
 * between 30s samples, so every sample was timing a reconnect and /health
 * reported ~37ms for what is really a 2-3ms query.
 */
const rttTimer = setInterval(sampleRtt, 30_000);

httpServer.listen(PORT, () => {
  console.log(`[socket] listening on :${PORT} region=${process.env.FLY_REGION ?? 'local'}`);
  void sampleRtt();
});

/**
 * Graceful shutdown. `fly deploy` sends SIGTERM and waits out `kill_timeout`
 * (30s in fly.toml), so closing sockets with 1001 "going away" tells clients
 * this was a deploy and they should reconnect, rather than leaving them to
 * infer it from a dropped TCP connection.
 */
function shutdown(signal: string) {
  console.log(`[socket] ${signal} — closing ${live.size} connections`);
  clearInterval(heartbeat);
  clearInterval(rttTimer);
  // A pending auto-advance would keep the event loop alive past the drain
  // window, and Fly would kill the process instead of letting it close sockets.
  clearAllTimers();
  // Tell every Game a restart is coming before the 1001s land, so clients can
  // show "reconnecting" rather than inferring it from a dropped socket.
  for (const code of new Set([...live.values()].map((c) => c.gameCode))) {
    broadcast(code, { type: 'server_restarting' });
  }
  for (const ws of live.keys()) ws.close(1001, 'server restarting');
  httpServer.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
