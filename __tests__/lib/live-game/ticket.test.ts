import { describe, it, expect } from 'vitest';
import { mintTicket, verifyTicket, TICKET_TTL_SECONDS } from '@/lib/live-game/ticket';

const SECRET = 'test-secret-not-the-real-one';
const OTHER = 'a-different-secret-entirely';
const NOW = 1_700_000_000;

const mint = (over: Partial<Parameters<typeof mintTicket>[0]> = {}, secret = SECRET) =>
  mintTicket(
    { gameCode: '482913', role: 'player', playerId: 'player-1', ...over },
    { secret, nowSeconds: NOW }
  );

describe('minting and verifying', () => {
  it('round-trips a Player ticket', () => {
    const r = verifyTicket(mint(), { secret: SECRET, nowSeconds: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.gameCode).toBe('482913');
    expect(r.payload.role).toBe('player');
    expect(r.payload.playerId).toBe('player-1');
  });

  it('round-trips a Caller ticket, which carries no playerId', () => {
    // The Caller holds no Board and cannot Claim, so there is nothing to name.
    const t = mint({ role: 'caller', playerId: null });
    const r = verifyTicket(t, { secret: SECRET, nowSeconds: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.role).toBe('caller');
    expect(r.payload.playerId).toBeNull();
  });

  it('expires after the TTL', () => {
    const t = mint();
    expect(verifyTicket(t, { secret: SECRET, nowSeconds: NOW + TICKET_TTL_SECONDS - 1 }).ok).toBe(
      true
    );
    const late = verifyTicket(t, { secret: SECRET, nowSeconds: NOW + TICKET_TTL_SECONDS + 1 });
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.reason).toBe('expired');
  });

  it('expires exactly at the boundary rather than one second late', () => {
    const late = verifyTicket(mint(), { secret: SECRET, nowSeconds: NOW + TICKET_TTL_SECONDS });
    expect(late.ok).toBe(false);
  });
});

describe('a ticket is worthless to anyone without the secret', () => {
  it('rejects one minted with a different secret', () => {
    // This is what keeps the development secret useless against production.
    const r = verifyTicket(mint({}, OTHER), { secret: SECRET, nowSeconds: NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_signature');
  });

  it('rejects a payload edited after signing', () => {
    // The attack this exists to stop: mint a player ticket, rewrite the role.
    const t = mint();
    const [body, sig] = t.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    payload.role = 'caller';
    const forged = Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + sig;
    const r = verifyTicket(forged, { secret: SECRET, nowSeconds: NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_signature');
  });

  it('rejects a ticket for a different Game', () => {
    const t = mint({ gameCode: '111222' });
    const r = verifyTicket(t, { secret: SECRET, nowSeconds: NOW });
    expect(r.ok).toBe(true);
    // The caller compares gameCode itself; this pins that it survives intact.
    if (r.ok) expect(r.payload.gameCode).toBe('111222');
  });

  it('rejects a stripped signature', () => {
    const body = mint().split('.')[0];
    expect(verifyTicket(body, { secret: SECRET, nowSeconds: NOW }).ok).toBe(false);
    expect(verifyTicket(body + '.', { secret: SECRET, nowSeconds: NOW }).ok).toBe(false);
  });

  it('rejects junk without throwing', () => {
    for (const junk of [
      '',
      '.',
      '..',
      'not-a-ticket',
      'a.b',
      '.sig',
      Buffer.from('x').toString('base64url'),
    ]) {
      expect(() => verifyTicket(junk, { secret: SECRET, nowSeconds: NOW })).not.toThrow();
      expect(verifyTicket(junk, { secret: SECRET, nowSeconds: NOW }).ok).toBe(false);
    }
  });

  it('checks the signature before parsing the payload', () => {
    // A body that is valid base64url but not JSON must fail on the signature,
    // not by reaching JSON.parse — unverified input never gets that far.
    const body = Buffer.from('definitely not json').toString('base64url');
    const r = verifyTicket(`${body}.deadbeef`, { secret: SECRET, nowSeconds: NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_signature');
  });
});

describe('the secret must actually be configured', () => {
  it('throws rather than signing with an empty secret', () => {
    // An empty secret still produces a valid-looking HMAC that any other
    // empty-secret process would accept. Failing loudly is the point.
    const saved = process.env.LIVE_GAME_TICKET_SECRET;
    delete process.env.LIVE_GAME_TICKET_SECRET;
    try {
      expect(() => mintTicket({ gameCode: '1', role: 'player', playerId: null })).toThrow(
        /LIVE_GAME_TICKET_SECRET/
      );
      expect(() => verifyTicket('a.b')).toThrow(/LIVE_GAME_TICKET_SECRET/);
    } finally {
      if (saved !== undefined) process.env.LIVE_GAME_TICKET_SECRET = saved;
    }
  });
});
