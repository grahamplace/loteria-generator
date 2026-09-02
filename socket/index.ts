/**
 * Live game socket server — SPIKE.
 *
 * Not the real server. This exists to answer the two questions ticket 11
 * deferred, because both can invalidate
 * `docs/adr/0001-live-game-realtime-architecture.md`:
 *
 *   1. Does Fly's proxy kill a WebSocket that goes idle? A manual-draw Lotería
 *      game can sit silent for minutes between Calls. If the proxy hangs up,
 *      the architecture needs revisiting.
 *   2. What is the Fly `iad` → Neon `us-east-1` round trip? Every Call is a
 *      write-through, so this lands on the critical path of the whole game.
 *
 * It holds no game state and speaks no protocol. `GET /health` reports what it
 * has observed so the answers can be read off a URL instead of a log tail.
 */
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Pool } from 'pg';

const PORT = Number(process.env.PORT ?? 8080);
const HEARTBEAT_MS = 25_000;
const DEAD_AFTER_MISSED = 2;

const startedAt = Date.now();

// ---------------------------------------------------------------------------
// Neon
// ---------------------------------------------------------------------------

/**
 * `pg`, not `@neondatabase/serverless`: the HTTP driver has no transaction
 * support, which the real server needs. A short idle timeout keeps the pool
 * from holding connections Neon would rather reclaim, and the `error` handler
 * is not optional — an unhandled pool error takes the process down.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[pool] idle client error', err.message);
});

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

wss.on('connection', (ws, req) => {
  const id = nextId++;
  const now = Date.now();
  live.set(ws, { id, openedAt: now, missedPongs: 0, lastTrafficAt: now });
  console.log(`[ws] open #${id} from ${req.socket.remoteAddress} (${live.size} live)`);

  ws.send(JSON.stringify({ type: 'hello', id, serverNow: new Date().toISOString() }));

  ws.on('pong', () => {
    const c = live.get(ws);
    if (c) c.missedPongs = 0;
  });

  ws.on('message', async (raw) => {
    const c = live.get(ws);
    if (c) c.lastTrafficAt = Date.now();
    // One command, so the RTT can be sampled on demand from a client.
    if (raw.toString().trim() === 'rtt') {
      const ms = await sampleRtt();
      ws.send(JSON.stringify({ type: 'rtt', ms }));
    }
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

/** Background RTT sampling, so /health has data without a client asking. */
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
