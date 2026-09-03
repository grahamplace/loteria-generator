/**
 * Handshake tickets. See docs/adr/0001-live-game-realtime-architecture.md.
 *
 * The socket server is on a different origin from the app, so the better-auth
 * cookie does not ride along on the WebSocket handshake. Next.js mints a
 * short-lived HMAC-signed ticket instead and the `ws` server verifies it
 * offline against a shared secret — no network call between them, and exactly
 * one place in the system understands better-auth.
 *
 * Node's built-in `crypto` only: no new auth dependency for a signed blob.
 *
 * Imported by both Next.js and the socket server, so this file must not touch
 * the database or anything Next-specific.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Long enough to survive a slow page load, short enough that a leak is stale. */
export const TICKET_TTL_SECONDS = 60;

/** Bumped only if the payload shape changes; lets old tickets be rejected outright. */
const TICKET_VERSION = 1;

export type TicketRole = 'caller' | 'player';

export type TicketPayload = {
  v: number;
  gameCode: string;
  role: TicketRole;
  /** `game_players.id` for a Player; the Caller holds no Board, so null. */
  playerId: string | null;
  /** Unix seconds. */
  exp: number;
};

export type VerifyResult =
  | { ok: true; payload: TicketPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'wrong_version' };

const b64url = (buf: Buffer) => buf.toString('base64url');

function sign(body: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(body).digest());
}

function secretOrThrow(): string {
  const secret = process.env.LIVE_GAME_TICKET_SECRET;
  if (!secret) {
    // Loud rather than silently unsigned: an empty secret would still produce a
    // valid-looking HMAC that any other empty-secret process would accept.
    throw new Error('LIVE_GAME_TICKET_SECRET is not set');
  }
  return secret;
}

export function mintTicket(
  input: { gameCode: string; role: TicketRole; playerId: string | null },
  opts: { secret?: string; nowSeconds?: number; ttlSeconds?: number } = {}
): string {
  const secret = opts.secret ?? secretOrThrow();
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const payload: TicketPayload = {
    v: TICKET_VERSION,
    gameCode: input.gameCode,
    role: input.role,
    playerId: input.playerId,
    exp: now + (opts.ttlSeconds ?? TICKET_TTL_SECONDS),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body, secret)}`;
}

export function verifyTicket(
  ticket: string,
  opts: { secret?: string; nowSeconds?: number } = {}
): VerifyResult {
  const secret = opts.secret ?? secretOrThrow();
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);

  const dot = ticket.indexOf('.');
  if (dot <= 0 || dot === ticket.length - 1) return { ok: false, reason: 'malformed' };
  const body = ticket.slice(0, dot);
  const provided = ticket.slice(dot + 1);

  // Signature first, before parsing anything: never let an unverified payload
  // reach JSON.parse or any downstream logic.
  const expected = sign(body, secret);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak length
  // through the exception path — check it as a plain comparison first.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: TicketPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (payload?.v !== TICKET_VERSION) return { ok: false, reason: 'wrong_version' };
  if (
    typeof payload.gameCode !== 'string' ||
    (payload.role !== 'caller' && payload.role !== 'player') ||
    typeof payload.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }
  if (payload.exp <= now) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}
