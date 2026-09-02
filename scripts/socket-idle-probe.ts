/**
 * Idle-socket probe — SPIKE tooling for the live game socket server.
 *
 * Opens one WebSocket and then says nothing, which is exactly what a Player's
 * phone does between Calls in a manual-draw game. If Fly's proxy hangs up on a
 * quiet connection, this is where it shows.
 *
 *   pnpm socket:probe                          # ws://localhost:8080
 *   pnpm socket:probe wss://loteria-live-game.fly.dev
 *   pnpm socket:probe wss://…fly.dev --minutes 20
 *
 * Leave it running. Every close is printed with how long the socket was held
 * and how long it had been silent, which is the whole answer.
 */
import WebSocket from 'ws';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--')) ?? 'ws://localhost:8080';
const minutesIdx = args.indexOf('--minutes');
const minutes = minutesIdx === -1 ? 15 : Number(args[minutesIdx + 1]);

const openedAt = Date.now();
const held = () => ((Date.now() - openedAt) / 1000).toFixed(0);
const stamp = () => new Date().toISOString().slice(11, 19);

console.log(`[probe] connecting to ${url}, holding idle for ${minutes} min`);
console.log('[probe] a clean run prints nothing but ticks until the timer ends\n');

const ws = new WebSocket(url);

ws.on('open', () => console.log(`${stamp()} open`));
ws.on('message', (d) => console.log(`${stamp()} message after ${held()}s: ${d}`));
// Ping frames are the server's heartbeat. `ws` auto-pongs; this only proves
// the proxy is letting control frames through.
ws.on('ping', () => console.log(`${stamp()} ← ping (held ${held()}s)`));
ws.on('error', (e) => console.error(`${stamp()} error after ${held()}s: ${e.message}`));

ws.on('close', (code, reason) => {
  console.log(`\n${stamp()} CLOSED after ${held()}s — code ${code} ${reason.toString() || ''}`);
  console.log(
    code === 1000 || code === 1001
      ? '[probe] clean close (server-initiated, e.g. a deploy).'
      : '[probe] unexpected close — if this lands near a round minute with no deploy, ' +
          "suspect the proxy's idle timeout."
  );
  process.exit(code === 1000 || code === 1001 ? 0 : 1);
});

const tick = setInterval(() => console.log(`${stamp()} still open, ${held()}s idle`), 60_000);

setTimeout(() => {
  clearInterval(tick);
  console.log(`\n${stamp()} held ${held()}s with no application traffic and no drop.`);
  console.log('[probe] Fly does not kill idle WebSockets at this duration.');
  ws.close(1000, 'probe done');
}, minutes * 60_000).unref?.();
