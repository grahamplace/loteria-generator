/**
 * Who is connected, and how a message reaches them.
 *
 * A connection is a disposable *view* of an identity, never the identity
 * itself: a Caller can cast a laptop to the TV while drawing from a phone, and
 * a Player can have the tab open twice. So everything here fans out to every
 * connection an identity holds — a message sent to only the socket that caused
 * it leaves the second screen silently stale.
 */
import type { WebSocket } from 'ws';
import type { TicketRole } from '@/lib/live-game/ticket';
import type { LiveGame } from './game-registry';

export type Conn = {
  id: number;
  ws: WebSocket;
  gameCode: string;
  role: TicketRole;
  /** null for the Caller, who holds no Board and cannot Claim. */
  playerId: string | null;
  openedAt: number;
  lastTrafficAt: number;
  missedPongs: number;
};

const byGame = new Map<string, Set<Conn>>();

export function addConn(conn: Conn): void {
  let set = byGame.get(conn.gameCode);
  if (!set) byGame.set(conn.gameCode, (set = new Set()));
  set.add(conn);
}

export function removeConn(conn: Conn): void {
  const set = byGame.get(conn.gameCode);
  if (!set) return;
  set.delete(conn);
  if (set.size === 0) byGame.delete(conn.gameCode);
}

export function connsFor(gameCode: string): Conn[] {
  return [...(byGame.get(gameCode) ?? [])];
}

export function connCount(): number {
  let n = 0;
  for (const set of byGame.values()) n += set.size;
  return n;
}

export function send(conn: Conn, msg: unknown): void {
  if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(JSON.stringify(msg));
}

/** Everyone in the Game. */
export function broadcast(gameCode: string, msg: unknown): void {
  const payload = JSON.stringify(msg);
  for (const conn of connsFor(gameCode)) {
    if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(payload);
  }
}

/**
 * Caller connections only. Marks travel this way and no further: sending them
 * to everyone would be ~40,000 messages a Game and would let Players read each
 * other's Boards.
 */
export function broadcastToCaller(gameCode: string, msg: unknown): void {
  const payload = JSON.stringify(msg);
  for (const conn of connsFor(gameCode)) {
    if (conn.role === 'caller' && conn.ws.readyState === conn.ws.OPEN) conn.ws.send(payload);
  }
}

/** Every connection one Player holds — their phone and their tablet. */
export function sendToPlayer(gameCode: string, playerId: string, msg: unknown): void {
  const payload = JSON.stringify(msg);
  for (const conn of connsFor(gameCode)) {
    if (conn.playerId === playerId && conn.ws.readyState === conn.ws.OPEN) conn.ws.send(payload);
  }
}

/** Recount live sockets per Player so the roster's online flag stays honest. */
export function recountConnections(game: LiveGame): void {
  for (const player of game.players.values()) player.connections = 0;
  for (const conn of connsFor(game.code)) {
    if (!conn.playerId) continue;
    const player = game.players.get(conn.playerId);
    if (player) player.connections++;
  }
}
