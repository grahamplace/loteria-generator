# Realtime transport for live Lotería play

Research ticket: `.scratch/live-game/issues/01-realtime-transport-options.md`
Date: 2026-09-01
Status: findings + recommendation. The decision itself is ticket 03.

## Question

Which transport carries Game events (card called, player joined, win declared,
live stats) between the server, one Caller, and up to 50 Players per Game,
sized for ~20 concurrent Games (≈1,000 open connections at peak)?

Criteria, in priority order: learning value (owner writes and understands the
socket/event/reconnect code), Vercel compatibility, server-originated events
(auto-advance timer must push), reconnection support, cost at target scale,
ops burden.

Sizing assumptions used for every cost figure below (change these and the
numbers move):

- Peak: 20 concurrent Games × 51 connections = ~1,000 sockets, for a few hours
  on a busy evening, not 24/7.
- Volume: ~200 Games/month, ~45 min each, ~60 calls + ~40 join/stat events per
  Game, each fanned out to ~51 clients → ~5,000 deliveries/Game, ~1M
  deliveries/month, ~460k connection-minutes/month.
- Payloads are tiny (a card id, a nickname, a count).

## Comparison

| | 1. WebSockets on Vercel Functions | 2. SSE route handler + Redis pub/sub | 3a. Ably / Pusher | 3b. Cloudflare Durable Objects (`partyserver`) | 3c. Liveblocks | 4. Own `ws` server on Fly.io / Railway |
|---|---|---|---|---|---|---|
| Learning value | Medium. You write reconnect + resync, but the upgrade API is a Vercel shim and fan-out is delegated to Redis. | Medium-low. Browser `EventSource` reconnects for you; you write the stream, `Last-Event-ID` resume, and Redis fan-out. Unidirectional, so client actions are plain POSTs. | Low. SDK owns connection, reconnect, rooms. You write publish calls. | Medium-high. You write the room class, connection registry, broadcast, alarm timer. `partysocket` hides reconnect unless you use raw `WebSocket`. | Low, and built for CRDT docs not broadcast. | **High.** You write handshake auth, rooms, heartbeat, broadcast, reconnect, resync, graceful deploy. Nothing is hidden. |
| Vercel compatibility | Native, but `experimental_` and Public Beta (June 2026). `next dev` does not work; needs `vc dev`. | Native, documented pattern. | Client SDK anywhere; server publishes over REST from a route handler. | Separate Cloudflare deploy. Next.js on Vercel calls the Worker over HTTP. | Client SDK anywhere; server publishes over REST. | Separate deploy. Next.js on Vercel mints a token and calls the WS server over HTTP. |
| Server-originated timer | Awkward. An instance holds the Caller's socket at most `maxDuration`; the timer must live in Inngest/cron and publish through Redis. | Same as 1: timer lives in Inngest/cron and publishes to Redis. | Timer lives in Inngest/cron, publishes over REST. | **Native.** Durable Object Alarms wake the object on schedule. | Timer lives in Inngest/cron. | **Native.** `setTimeout` in the process that owns the Game. |
| Reconnection | Forced: connections close at `maxDuration` (Hobby 300s hard cap; Pro 800s GA, 1800s beta). Reconnect may land on a different instance. | Forced at `maxDuration` too, but `EventSource` auto-reconnects and sends `Last-Event-ID`. | SDK auto-reconnect. Ably replays missed messages within 2 min; Pusher does not replay. | `partysocket` auto-reconnects with backoff; hibernation keeps sockets open while idle. | SDK auto-reconnect. | You write it (or take Socket.IO's, which includes 2-min connection-state recovery). Deploys drop every socket. |
| Cost at target scale | Likely inside Hobby's included 4 CPU-hr + 360 GB-hr/month; Active CPU is ~0 while sockets idle. Instance density per connection is not published, so memory-hours are unverifiable. Plus Redis (Upstash free tier: 500k commands/month). | Same compute profile as 1, plus Redis. Upstash SUBSCRIBE holds a connection per stream; per-plan concurrent-connection cap is not published. | Ably: free tier caps at 200 concurrent connections (< 1,000 peak) → Standard $29/mo + small overage. Pusher: free 100 connections; 1,000 peak needs Pro $99/mo. | Free plan covers it (SQLite-backed DOs, 100k req/day). Paid $5/mo base if exceeded. Hibernated sockets accrue no duration charge. | Free tier is 10 connections per room; a 51-person Game does not fit. Paid per-room cap could not be verified. | Fly shared-cpu-1x 256MB ≈ $2/mo, 512MB ≈ $4–5/mo, always-on. Railway ≈ $15–20/mo. No Redis needed while one process owns all Games. |
| Ops burden | None beyond Vercel. Redis is a Marketplace add-on. | Same. | None. | One Worker deploy (`wrangler`), a second dashboard. | None. | One extra service: Dockerfile, `fly deploy`, health check, logs, and a deploy story that drops sockets. |
| Fit for 51-client rooms | Needs Redis: "connections are not guaranteed to reach the same instance." | Needs Redis, same reason. | Fine. | Fine; one DO per Game. | Does not fit on free; unverified on paid. | Fine; in-memory `Map<gameCode, Set<ws>>`. |

## Per-option notes

### 1. WebSockets on Vercel Functions (Fluid Compute)

- Status: Public Beta since 2026-06-22. "WebSocket connections run on Fluid
  compute and follow the same limits and pricing as other Function
  invocations." "With Active CPU pricing, billing only applies to the time your
  Function spends processing messages, not idle connection time."
  https://vercel.com/changelog/websocket-support-is-now-in-public-beta
- Next.js path: "Next.js does not expose an API for handling WebSocket
  upgrades. As a workaround, you can use the `experimental_upgradeWebSocket()`
  API." The API reference adds: it "only works on the Vercel platform and gives
  you less control over the request lifecycle; when possible, you should handle
  WebSocket connections using native Node.js APIs instead." Requires the `ws`
  package and Fluid Compute; local dev only through `vc dev`.
  https://vercel.com/docs/functions/websockets#next-js
  https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#experimental_upgradewebsocket
- Duration: "WebSocket connections close when a Vercel Function reaches its
  maximum duration." Limits: Hobby 300s default and max; Pro 300s default,
  800s max, 1800s extended max (beta, per-function config).
  https://vercel.com/docs/functions/websockets#handle-disconnections-and-reconnects
  https://vercel.com/docs/functions/limitations#max-duration
- Fan-out: "A single WebSocket connection is pinned to one Vercel Function
  instance … Fluid compute allows a single function instance to handle multiple
  WebSocket connections." But "New WebSocket connections are not guaranteed to
  reach the same Vercel Function instance … Store durable state, presence,
  counters, rooms, and pub/sub coordination in an external data store."
  https://vercel.com/docs/functions/websockets#manage-persistent-state
  https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel
- Pricing (iad1): Active CPU $0.128/hr, provisioned memory $0.0106/GB-hr;
  Hobby includes 4 CPU-hr, 360 GB-hr, 1M invocations per month.
  https://vercel.com/docs/functions/usage-and-pricing#regional-pricing
- Next.js itself: the bundled docs still say "WebSockets won't work because
  the connection closes on timeout, or after the response is generated" for
  hosts that deploy route handlers as lambdas
  (`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`,
  Next 16.2.4). A first-class `NextResponse.upgrade()` is an unmerged draft
  RFC. https://github.com/vercel/next.js/discussions/95514
- UNVERIFIED: how many connections one Fluid instance holds, so the real
  memory-hour cost at 1,000 sockets.

What this means for a 45-minute Game: on Hobby every player reconnects at
least 8 times, each time possibly to a different instance, and the Caller's
auto-advance timer cannot live in any function. It has to be an Inngest job
publishing to Redis, with every instance subscribed. Two moving parts
(experimental upgrade API + Redis pub/sub) for one feature.

### 2. Server-Sent Events from a route handler + Upstash Redis

- Streaming is a supported route-handler pattern: return a `ReadableStream` in
  a `Response`, `Content-Type: text/event-stream`. GET handlers are dynamic by
  default since Next 15.
  https://nextjs.org/docs/app/api-reference/file-conventions/route
  https://vercel.com/docs/functions/streaming-functions
- The same `maxDuration` limits apply to streamed responses ("including
  streamed responses"), ending in a 504 `FUNCTION_INVOCATION_TIMEOUT`.
  https://vercel.com/docs/functions/limitations
- Fan-out still needs Redis for the same reason as option 1: "A connection
  stays on the instance that accepted it for its entire life."
  https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel
- Upstash: the REST API exposes SUBSCRIBE as an SSE stream, so
  `@upstash/redis` works without TCP; `ioredis` also works. Free tier: 256 MB,
  500k commands/month, 1 database. PAYG: $0.20 per 100k commands.
  https://upstash.com/docs/redis/features/restapi
  https://upstash.com/pricing/redis
  UNVERIFIED: the numeric max-concurrent-connections cap per plan
  (`ERR max concurrent connections exceeded` exists but the limit is not
  published). 1,000 held subscriptions is the risk.
- Upstash Realtime is a packaged version of exactly this (Redis Streams + SSE,
  "Deploy anywhere: Vercel"), with its own client that reconnects every 300s.
  https://upstash.com/docs/realtime/overall/quickstart
- Browser side: `EventSource` reconnects automatically, honours `retry:`, and
  resends `Last-Event-ID` so the server can resume.
  https://html.spec.whatwg.org/multipage/server-sent-events.html

Cheapest all-on-Vercel option and the most forgiving reconnect story, but the
browser does the reconnecting for you, the channel is one-way, and the timer
still lives in Inngest. Less to learn than the ticket asks for.

### 3a. Ably and Pusher Channels

- Ably free: 200 concurrent connections, 6M messages/month, 200 channels.
  Standard: $29/mo, 10k connections included, then $2.50/M messages and
  $1.00/M connection-minutes. https://ably.com/pricing
  Reconnect: retries every 15s for 2 min and replays missed messages in that
  window; ordering after reconnect is not guaranteed.
  https://ably.com/docs/connect/states
  Server publish: REST API. https://ably.com/docs/api/rest-api
- Pusher free (Sandbox): 100 connections, 200k messages/day. Startup $49
  (500 conns), Pro $99 (2,000 conns), Business $299 (5,000).
  https://pusher.com/channels/pricing/
  Reconnect is automatic (`autoReconnect`), but there is no server-side
  replay of missed messages.
  https://pusher.com/docs/channels/using_channels/connection/
  Server publish: `POST /apps/{id}/events`, 10 KB per event.
  https://pusher.com/docs/channels/library_auth_reference/rest-api/
- Neither runs server logic on a timer; the auto-advance job lives in Inngest.
- At the sizing above: Ably ≈ $30/mo, Pusher ≈ $99/mo. Both exceed their free
  tiers on peak connections alone.

### 3b. PartyKit / Cloudflare Durable Objects

- PartyKit joined Cloudflare in April 2024; the original repo now says
  development continues in `cloudflare/partykit`, whose README calls itself
  "a Work in Progress". `partyserver` (server) and `partysocket` (reconnecting
  client) are the maintained pieces; the hosted partykit.io platform is in
  maintenance. https://github.com/partykit/partykit
  https://github.com/cloudflare/partykit
- Free plan: "Workers Free plan can only create and access SQLite-backed
  Durable Objects"; 100k requests/day, 13k GB-s/day. Paid: $5/mo base, $0.15/M
  requests after 1M, "Billable Duration (GB-s) charges do not accrue during
  hibernation."
  https://developers.cloudflare.com/durable-objects/platform/pricing/
- WebSocket Hibernation keeps sockets open while the object sleeps; in-memory
  state is lost, restored via `serializeAttachment` (16 KB cap) or Storage.
  https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Alarms: "schedule the Durable Object to be woken up at a time in the
  future … guaranteed at-least-once execution."
  https://developers.cloudflare.com/durable-objects/api/alarms/
- No vendor publish endpoint; Next.js calls an HTTP route you write on the
  Worker.

Strongest technical fit of the hosted options (one object per Game, native
timer, near-zero cost) and a real amount of code to write. The cost is a
second platform (Cloudflare account, `wrangler`, Workers runtime quirks) and
`partyserver`'s self-declared WIP status.

### 3c. Liveblocks

- Free: 10 simultaneous connections per room, watermark required for
  commercial use. Pro: $30/mo + usage. https://liveblocks.io/pricing
- A 51-client Game exceeds the free per-room cap. The Pro cap could not be
  read reliably from the JS-rendered docs (search snippet said 50, page said
  10). UNVERIFIED, and either number disqualifies it.
- Built for presence/CRDT collaboration, not broadcast rooms. Not pursued.

### 4. Own Node `ws` (or Socket.IO) server on Fly.io / Railway

- Fly.io: shared-cpu-1x 256 MB ≈ $2.02/mo (ams), billed per second. No
  standing free tier: trial is "2 hours of machine runtime or 7 days of
  access, whichever comes first." https://fly.io/docs/about/pricing/
  https://fly.io/docs/about/free-trial/
  WebSockets need no config; TLS terminates at the edge.
  https://fly.io/blog/websockets-and-fly/
  UNVERIFIED: whether autostop waits for open sockets, and any proxy idle
  timeout. Set `min_machines_running = 1` and treat it as always-on.
  https://fly.io/docs/launch/autostop-autostart/
  Rolling deploys replace Machines one at a time, so open sockets on a
  cycled Machine drop. https://fly.io/docs/apps/deploy/
- Railway: Hobby $5/mo including $5 credit; $20/vCPU-month, $10/GB-month.
  https://railway.com/pricing
  WebSockets "are exempt from request timeouts and can stay open
  indefinitely." https://docs.railway.com/guides/sse-vs-websockets
  Services sleep after 5 min without outbound packets; disable for this.
  https://docs.railway.com/reference/app-sleeping
  Railway's own Socket.IO guide: past one instance you need the Redis
  adapter. https://docs.railway.com/guides/socketio
- `ws`: heartbeat via ping/pong is documented as the way to detect dead
  connections; `maxPayload` defaults to 100 MiB (set it to a few KB here);
  no client reconnect is provided.
  https://github.com/websockets/ws#how-to-detect-and-close-broken-connections
  https://github.com/websockets/ws/blob/master/doc/ws.md
- Socket.IO: reconnection on by default with exponential backoff; rooms;
  connection-state recovery replays missed packets for up to 2 min and the
  docs warn "you will still need to handle the case where the states … must
  be synchronized." https://socket.io/docs/v4/connection-state-recovery/
  https://socket.io/docs/v4/redis-adapter/
- Memory: UNVERIFIED from primary sources. Order of magnitude: a few KB of
  heap plus kernel buffers per idle socket, so 1,000 sockets ≈ 2–20 MB on top
  of a ~60 MB Node baseline. 256 MB fits; 512 MB is the safe pick.
- Auth handoff: browsers cannot set headers on the WebSocket handshake
  (`protocols` is for sub-protocols only), so the token rides in the URL or
  the first message. https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket
  better-auth's JWT plugin issues a token and a JWKS endpoint so "the token
  can be verified in your own service, without the need for an additional
  verify call or database check." https://www.better-auth.com/docs/plugins/jwt
  Only the Caller is a better-auth user; Players carry the per-device token
  the map already specifies, validated against the Game row.

## Recommendation

**Option 4: a small Node `ws` server on Fly.io, one always-on 512 MB Machine,
Next.js on Vercel as the control plane.** Runner-up: Durable Objects with
`partyserver`, if a second platform is acceptable and native alarms are worth
more than raw-Node familiarity.

Why it wins on the ticket's ordering:

1. Learning value. Every piece the map calls out (socket lifecycle, rooms,
   server push, heartbeat, reconnect with resync, deploy-safe shutdown) is
   code the owner writes against the plain `ws` API and the browser
   `WebSocket` API. Options 1 and 2 hand the hardest part (fan-out) to Redis
   and the reconnect to the browser or a shim; option 3 hands all of it to an
   SDK.
2. Vercel compatibility. Next.js stays untouched: a route handler mints a
   short-lived JWT (better-auth JWT plugin) for the Caller, Players get a
   device token, and the WS server exposes one internal HTTP route for
   Next.js to create/end Games. No experimental Vercel API, no `vc dev`.
3. Server-originated events. One process owns every Game, so the
   auto-advance timer is a `setTimeout` next to the room map. No Inngest hop,
   no pub/sub. This is the single biggest simplification over options 1–3a.
4. Reconnection. Nothing forces a reconnect every 5 minutes (Vercel's
   `maxDuration` does, on every plan). Reconnects happen on real network
   drops and on deploys, which is exactly the case worth handling well:
   client backoff, resume by `gameCode + playerToken`, server replays the
   call log from Postgres.
5. Cost. ≈ $4–5/mo, fixed. No Redis, no per-connection metering.
6. Ops burden. This is the trade-off. It is the only option that adds a
   deployable: a Dockerfile, `fly deploy`, a health check, logs in a second
   dashboard, and a hard ceiling of one Machine before a Redis adapter or
   sticky routing is needed. Every deploy drops every live socket, so the
   reconnect/resync path is not optional polish, it runs on every ship.

The trade-off, spelled out: you are choosing ~$5/mo plus a second small
service to run, in exchange for owning the whole realtime path and avoiding
Vercel's forced 300s/800s socket lifetime and its Redis fan-out requirement.
If the second service turns out to be the part that stalls the project,
option 2 (SSE + Upstash) is the fallback that keeps everything on Vercel with
the least new code, at the price of a one-way channel and an Inngest-owned
timer.

Open questions this hands to ticket 03 (transport-and-hosting decision):

- Fly.io vs Railway. Fly is cheaper and has WebSocket-specific docs; Railway
  documents "no timeout on WebSockets" and zero-downtime health-check
  deploys explicitly. Either works; pick by which dashboard the owner wants
  to live in.
- Raw `ws` vs Socket.IO. Raw `ws` maximises learning (you write reconnect and
  recovery); Socket.IO gives rooms, reconnect and 2-min state recovery for
  free and is the more common resume line. Recommend raw `ws` given
  criterion 1, with a hand-written protocol documented in ticket 10.
- Durable game state: Postgres (Neon) as the source of truth with the WS
  process as a cache, so a Machine restart or deploy can rebuild rooms.
  That is ticket 02.
