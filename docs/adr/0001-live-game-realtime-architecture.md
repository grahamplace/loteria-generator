# Live Game realtime architecture: own `ws` server on Fly.io, Neon as source of truth

Status: accepted (2026-09-01)

Live Lotería play needs a server that can push events (card called, player
joined, win verified) to one Caller and up to 50 Players per Game, hold an
auto-advance timer, and arbitrate two operations that must be atomic — "claim
this exact 16-card Board" and "verify this ¡Lotería! against the call log".
Vercel's own WebSocket and SSE support closes connections at `maxDuration` and
does not pin them to one instance, so either would force a Redis pub/sub layer
plus an Inngest-owned timer.

**We run our own Node `ws` server on a single always-on Fly.io Machine
(region `iad`, shared-cpu-1x 512 MB, ~$4–5/mo), with Neon Postgres as the
source of truth and Next.js on Vercel as the control plane.** One process owns
every Game, so arbitration is a synchronous check-and-set on Node's event loop
and the timer is a plain `setTimeout` — no Redis, no second coordination
system. This was chosen with learning value as the leading criterion (see
Consequences): the owner writes the handshake auth, rooms, heartbeat,
broadcast, reconnect and graceful-shutdown code by hand.

## The shape

- **Transport.** Node `ws`, one Fly Machine, `min_machines_running = 1`,
  `auto_stop_machines = off`, `kill_signal = SIGTERM` with a `kill_timeout`
  long enough to flush and close.
- **Code location.** `socket/` inside the existing root package, bundled with
  tsup into a single JS file; `Dockerfile` and `fly.toml` at the repo root. No
  pnpm workspace and no second repo, so `db/schema.ts` cannot drift from the
  schema Drizzle migrates.
- **State.** Each Game is an object in memory on the `ws` process. Every state
  change is **written through to Neon before it is acked or broadcast**. On
  boot the process rehydrates `lobby` and `playing` Games.
  Persisted: Games, Players and their assigned Board, the Call log, Wins,
  `next_call_due_at`. Never persisted: Marks — they are client-side by design
  and travel inside the win claim.
- **Backstops.** `UNIQUE (game_id, board_key)` (no two Players hold the same
  16 cards) and `UNIQUE (game_id, card_id)` (a card is called at most once),
  both with `INSERT … ON CONFLICT DO NOTHING`. The event loop is the primary
  arbiter; these catch a future second instance or a rehydrate race.
- **Vercel ↔ Fly boundary.** **Postgres is the only interface. There is no HTTP
  between them.** "Play" is a Next.js server action that validates ownership,
  unlock state and card count, generates the Game Code, and inserts the `games`
  row as `lobby`. The `ws` server materializes the Game from Neon on the first
  socket that names its code. If Fly is down, "Play" still works — the page
  just cannot connect yet.
- **Handshake auth.** The socket is on a different origin, so the better-auth
  cookie does not ride along. Next.js mints a ~60-second HMAC-signed ticket
  (`gameCode`, `role`, `playerId`) with Node's built-in `crypto`; the `ws`
  server verifies it offline against a shared secret. No new auth dependency,
  and exactly one place in the system understands better-auth.
- **Database driver.** The `ws` server uses `pg` + `drizzle-orm/node-postgres`
  on the **pooled** connection string — not `@neondatabase/serverless`, whose
  HTTP driver has no transaction support. Neon is on the **Launch** plan, so
  scale-to-zero is disabled; even so the pool needs `pool.on('error', …)` (an
  unhandled pool error crashes Node) and a short `idleTimeoutMillis`.
- **Auto-advance timer.** In-process `setTimeout` next to the Game object.
  `next_call_due_at` is persisted with the Call that sets it; on boot the timer
  re-arms at `max(persisted deadline, now + 15s)` so it cannot fire into a room
  that is still reconnecting.
- **Local dev.** A third process in the `concurrently` list of `pnpm dev`; the
  client reads `NEXT_PUBLIC_WS_URL`.

## Considered and rejected

- **WebSockets on Vercel Functions** (`experimental_upgradeWebSocket`).
  Connections close at `maxDuration` (300s Hobby / 800s Pro) and "are not
  guaranteed to reach the same instance", so a 45-minute Game reconnects
  everyone repeatedly across instances and needs Redis for fan-out. The timer
  cannot live in a function at all. Also Public Beta, Vercel-only, and broken
  under `next dev`.
- **SSE route handler + Upstash Redis.** The cheapest all-on-Vercel option and
  the most forgiving reconnect story, but the browser does the reconnecting,
  the channel is one-way, and the timer moves to Inngest. Kept as the
  documented fallback if the Fly service proves not worth its keep.
- **Ably / Pusher.** Both exceed their free tiers on peak connections alone
  (~$30/mo and ~$99/mo respectively) and hide the connection code entirely.
- **Cloudflare Durable Objects via `partyserver`.** The strongest technical fit
  of the hosted options — one object per Game, native alarms, near-zero cost,
  and hibernation would have kept sockets open across deploys. Rejected for the
  second platform and `partykit`'s self-declared work-in-progress status.
- **Liveblocks.** 10 connections per room on free; built for CRDT documents,
  not broadcast rooms.
- **Redis as a hot store.** Unnecessary while one process owns every Game;
  it would add a second store to keep consistent for no gain at this scale.

## Consequences

- **Learning value is the leading criterion here, ahead of cost and ops.** This
  is a deliberate deviation: several rejected options are cheaper to operate.
  If that priority ever changes, the SSE + Upstash fallback is the exit.
- **A second deployable exists.** Its own Dockerfile, `fly deploy`, health
  check, logs and secrets. Every deploy drops every open socket; clients
  reconnect with backoff and resync full Game state, and auto-advance resumes
  on its own after the 15-second grace. Reconnect-and-resync had to be built
  anyway for sleeping phones and dropped wifi, so the deploy case is free.
- **Single point of failure, accepted knowingly.** One Machine holds every live
  Game, and Fly does not automatically restart a Machine on another host after
  a host failure. Nothing acked is lost — write-through plus boot rehydrate —
  but every live Game pauses until it is back, and recovery is manual.
- **Scaling past one instance is a future decision, not a future config
  change.** It requires a pub/sub adapter and moves arbitration out of the
  event loop and onto the unique indexes. Do not assume it is a small change.
- **The `ws` server has exactly one inbound surface (the WebSocket) and one
  outbound dependency (Neon).** Nothing in the app can push it an urgent
  message. A Set deleted mid-Game is caught by re-checking on load and on the
  next Call, not by a push from Vercel.
