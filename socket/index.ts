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
import { verifyTicket, type TicketRole } from '@/lib/live-game/ticket';
import { getGame, liveGameCount, type LiveGame } from './game-registry';
import { callerSnapshot, playerSnapshot } from './snapshot';
import { pool } from './db';

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

type Live = {
  id: number;
  openedAt: number;
  missedPongs: number;
  /** Wall-clock ms since this connection last sent or received anything. */
  lastTrafficAt: number;
  gameCode: string;
  role: TicketRole;
  /** null for the Caller, who holds no Board and cannot Claim. */
  playerId: string | null;
};

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

const live = new Map<WebSocket, Live>();
const closed: Closed[] = [];
let nextId = 1;

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

const send = (ws: WebSocket, msg: unknown) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

/**
 * Every connection an identity holds, so Calls and Marks fan out to all of
 * them. A Caller can cast a laptop to the TV and draw from their phone; losing
 * a tab is never losing your seat, so a connection is a disposable view of an
 * identity rather than the identity itself.
 */
const connectionsByGame = new Map<string, Set<WebSocket>>();

function register(ws: WebSocket, code: string) {
  let set = connectionsByGame.get(code);
  if (!set) connectionsByGame.set(code, (set = new Set()));
  set.add(ws);
}

function unregister(ws: WebSocket, code: string) {
  const set = connectionsByGame.get(code);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) connectionsByGame.delete(code);
}

/** Recount a Player's live sockets so the roster's online flag stays honest. */
function recountConnections(game: LiveGame) {
  for (const player of game.players.values()) player.connections = 0;
  for (const ws of connectionsByGame.get(game.code) ?? []) {
    const c = live.get(ws);
    if (!c?.playerId) continue;
    const player = game.players.get(c.playerId);
    if (player) player.connections++;
  }
}

wss.on('connection', async (ws, req) => {
  const id = nextId++;
  const now = Date.now();

  // The ticket is the entire handshake. It rides in the query string because
  // browsers cannot set headers on a WebSocket upgrade, and it is short-lived
  // precisely because a URL is the leakiest place to put a credential.
  const url = new URL(req.url ?? '/', 'http://localhost');
  const ticket = url.searchParams.get('ticket') ?? '';
  const verified = verifyTicket(ticket);

  if (!verified.ok) {
    console.log(`[ws] reject #${id}: ticket ${verified.reason}`);
    send(ws, { type: 'error', code: 'bad_ticket', reason: verified.reason });
    // 1008 policy violation, and a reason the client can show rather than a
    // silent drop it would retry forever.
    ws.close(1008, verified.reason);
    return;
  }

  const { gameCode, role, playerId } = verified.payload;
  const game = await getGame(gameCode);
  if (!game) {
    send(ws, { type: 'error', code: 'no_such_game' });
    ws.close(1008, 'no_such_game');
    return;
  }
  if (role === 'player' && (!playerId || !game.players.has(playerId))) {
    // A signed ticket naming a Player this Game does not have means the row was
    // deleted between minting and connecting. Do not invent a seat.
    send(ws, { type: 'error', code: 'no_such_player' });
    ws.close(1008, 'no_such_player');
    return;
  }

  live.set(ws, { id, openedAt: now, missedPongs: 0, lastTrafficAt: now, gameCode, role, playerId });
  register(ws, gameCode);
  recountConnections(game);
  console.log(`[ws] open #${id} ${role} game=${gameCode} (${live.size} live)`);

  send(ws, role === 'caller' ? callerSnapshot(game) : playerSnapshot(game, playerId!));

  ws.on('pong', () => {
    const c = live.get(ws);
    if (c) c.missedPongs = 0;
  });

  ws.on('message', async (raw) => {
    const c = live.get(ws);
    if (c) c.lastTrafficAt = Date.now();
    let msg: { type?: string };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'error', code: 'malformed' });
      return;
    }

    // Commands land here next. Resync is the one that already matters: it is
    // how a client recovers when it spots a gap in the version sequence.
    if (msg.type === 'resync') {
      const fresh = await getGame(gameCode);
      if (fresh) {
        send(ws, role === 'caller' ? callerSnapshot(fresh) : playerSnapshot(fresh, playerId!));
      }
      return;
    }

    send(ws, { type: 'error', code: 'unknown_command', received: msg.type ?? null });
  });

  ws.on('close', (code, reasonBuf) => {
    const c = live.get(ws);
    if (c) {
      closed.push({
        id: c.id,
        heldForSeconds: Math.round((Date.now() - c.openedAt) / 1000),
        idleForSeconds: Math.round((Date.now() - c.lastTrafficAt) / 1000),
        code,
        reason: reasonBuf.toString() || '(none)',
        closedAt: new Date().toISOString(),
      });
      if (closed.length > 100) closed.shift();
      console.log(`[ws] close #${c.id} code=${code} held=${closed.at(-1)!.heldForSeconds}s`);
    }
    live.delete(ws);
    unregister(ws, gameCode);
    // The Player stays in the Game — going offline is not leaving. Only the
    // online flag changes.
    void getGame(gameCode).then((g) => g && recountConnections(g));
  });
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
  for (const ws of live.keys()) ws.close(1001, 'server restarting');
  httpServer.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
