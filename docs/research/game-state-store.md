# Game state store for live Lotería play

Research ticket: `.scratch/live-game/issues/02-game-state-store-options.md`
Date: 2026-09-01
Status: findings + recommendation. The decision itself is ticket 03.
Pairs with: `docs/research/realtime-transport.md` (branch
`research/realtime-transport`), which recommends one always-on Node `ws`
server on Fly.io (region `iad`, Ashburn VA) with Next.js on Vercel as the
control plane. Neon lives in AWS `us-east-1` (N. Virginia), same metro.

## Question

Where does live Game state live: the call log, Players, assigned Boards,
Marks, and the auto-advance timer? Evaluated against the `ws`-on-Fly
transport for:

- latency per call event at ~20 concurrent Games × 50 Players;
- consistency for two operations that must be atomic under concurrent joins
  and claims: "claim this exact 16-card Board so no other Player in the Game
  holds the same 16-card set" and "verify a win against the call log";
- what survives a Fly deploy, a process crash, or a host failure;
- cost;
- how much the owner learns (resume project: prefer designs the owner writes
  and understands).

Sizing assumptions, carried over from the transport doc:

- Peak: 20 Games × 51 sockets ≈ 1,000 connections, evenings only.
- Volume: ~200 Games/month, ~45 min each, ~60 Calls + ~50 joins + a handful
  of win claims per Game.
- Write rate: one Call every 20–40 s per Game → at peak ~0.5–1 Call/s across
  all Games, plus joins in bursts at lobby time. ≈ 25k state-changing writes
  per month. Every store below is idle at this rate; the comparison is about
  guarantees and ergonomics, not throughput.

Two facts from the map shrink the problem before comparing stores:

1. **Marks are client-side.** "Marks are free client-side (honor system);
   server counts only marks on called cards when verifying a win." The
   server never stores a Mark; it receives the Player's marked cells inside
   the "¡Lotería!" claim and checks them against the call log. Marks drop
   out of the state-store question entirely.
2. **One process owns every Game.** With the Fly `ws` recommendation, all
   events for a Game arrive on one Node event loop. Node runs JavaScript
   single-threaded: a handler that checks and mutates a `Map` without an
   `await` in between cannot be interleaved by another handler. That is the
   same guarantee Cloudflare sells with Durable Objects ("single-threaded,
   globally-unique instance"). It makes both atomic operations trivial in
   memory; the store's job becomes durability, not arbitration.

## Comparison

| | 1. Neon Postgres only (Drizzle) | 2. Upstash Redis hot store + Postgres records | 3. In-memory on the `ws` server + write-through to Neon | 4. Cloudflare Durable Objects storage |
|---|---|---|---|---|
| Who arbitrates a claim | Postgres: `UNIQUE (game_id, board_key)` + `INSERT … ON CONFLICT DO NOTHING`, one statement, atomic under concurrency. | Redis: `SADD game:{code}:boards {key}` returns 1/0 atomically, or a Lua script. | The event loop: synchronous check-and-set on the Game's `Set<boardKey>`. Postgres unique index kept as a backstop. | The object: single-threaded per Game, storage ops transactional. |
| Who verifies a win | A transaction: lock the Game row (`FOR UPDATE`), read `game_calls`, insert `game_wins`. 2–3 round trips. | Lua script reading the calls set and the claim. One round trip. | Synchronous set intersection in memory, then one insert. | Synchronous read of `ctx.storage`, write coalesced. |
| Latency per Call (server-side, before broadcast) | ≥2 round trips to Neon (insert call, read state to broadcast) unless you keep a cache, at which point this is option 3. Neon publishes "single-digit ms" same-region for HTTP; Fly `iad` → AWS `us-east-1` RTT UNVERIFIED. | 1 write round trip, Upstash publishes "<5 ms" same-region p99 write. Plus a Postgres write if the call log must be durable. | 1 insert round trip (same as option 2's write), broadcast from memory. Nothing read back. | Local SQLite write; output gate holds outgoing messages until the write is confirmed. Fastest, but only if the transport is also a DO. |
| Survives `fly deploy` / crash | Yes. Postgres is the only truth. Sockets drop and clients resync from Postgres. | Redis survives (persisted to block storage; single instance on Free). The `ws` process still has to rebuild its socket rooms. | Yes, if every state change is committed before it is acknowledged, and boot rehydrates `lobby`/`playing` Games from Postgres and re-arms timers. Uncommitted in-flight events are lost (a Call the Caller must re-press). | Yes: storage and alarms persist; every deploy "restarts every Durable Object" and drops all sockets anyway. |
| Survives Fly host failure | Yes (nothing on Fly matters). | Yes for Redis; process must be restarted by hand ("does not automatically start again on another host"). | Same as option 1 once the Machine is back; recovery is manual on Fly. A Volume would not help: volumes are pinned to the failed host. | n/a (no Fly). |
| Timer ownership | `setTimeout` in the `ws` process, deadline stored in Postgres so a restart re-arms it. | Same, deadline in Redis or Postgres. | Same: `setTimeout` next to the Game object, `next_call_due_at` written through. | Native: one persisted alarm per object, at-least-once. |
| Cost at target scale | $0 incremental beyond the Neon plan the app already runs on; ~25k writes/month is noise. Compute-hours: Games keep the compute awake during play (see notes). | Upstash Free covers ~50k commands/month easily (500k cap); Fly-provisioned Redis is private to the Fly org. Second store, second dashboard. | Same as option 1. | Free plan fits (100k req/day, 5M rows read/day, 100k rows written/day). |
| Extra moving parts | None: same DB, same Drizzle schema, one more driver (`pg`) in the `ws` server. | Redis account or `fly redis create`, `ioredis`, Lua scripts, plus Postgres anyway for durable records. | None beyond option 1, plus ~100 lines of rehydrate + shutdown code. | Only sensible if the transport moves to Cloudflare too (ticket 01 runner-up). Otherwise a Worker hop per event for no gain. |
| Learning value | Medium: SQL transactions, row locks, `ON CONFLICT`. Hides the "actor per room" idea because Postgres arbitrates everything. | Medium-low: Redis data types and Lua; two stores to keep consistent, which is a lesson but not the one this project is for. | **High**: the owner writes a per-Game state machine, single-writer atomicity, write-through, rehydration, graceful shutdown. This is the same shape as Durable Objects, built by hand and therefore understood. | Medium-high, but the platform does the hard part (gates, alarms, replication). |

## Per-option notes

### 1. Neon Postgres tables via Drizzle, as the only store

The app already talks to Neon (`db/index.ts`: `@neondatabase/serverless`
`neon()` HTTP driver + `drizzle-orm/neon-http`, pooled endpoint in AWS
`us-east-1`). Tables for Games, Players/Boards, Calls, and Wins are a normal
migration.

- Driver from a long-lived process. Neon's guidance for persistent servers
  (Fly falls in this class): "use a standard TCP driver with connection
  pooling. Your server can maintain a connection pool across requests, making
  TCP the fastest and most efficient option." Named drivers: `pg`,
  `postgres.js`. https://neon.com/docs/connect/choose-connection
  The HTTP `neon()` function "can only send one query at a time … sessions and
  transactions are not supported."
  https://github.com/neondatabase/serverless
  Drizzle's `neon-http` driver throws `'No transactions support in neon-http
  driver'` on `db.transaction()`.
  https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/neon-http/session.ts
  So the `ws` server uses `pg` + `drizzle-orm/node-postgres`; Next.js keeps
  `neon-http`. Both can import the same `db/schema.ts`.
- Pooled vs direct connection string. "Use pooled connections by default.
  They handle up to 10,000 concurrent client connections." Through PgBouncer
  in transaction mode the unsupported list is: `SET`/`RESET`, `LISTEN`/
  `NOTIFY`, SQL-level `PREPARE`, temp tables with `PRESERVE`/`DELETE ROWS`,
  and session-level advisory locks. Transaction-level advisory locks
  (`pg_advisory_xact_lock`) and protocol-level prepared statements work.
  https://neon.com/docs/connect/connection-pooling
  Direct `max_connections` is 104 on a 0.25 CU compute (7 reserved).
  https://neon.com/docs/manage/computes
  A `pg.Pool({ max: 5 })` on the pooled string is plenty for one process.
- Scale-to-zero. Free plan suspends after 5 minutes idle and this "cannot
  [be] disable[d]"; Launch can disable it; Scale is configurable to always
  on. https://neon.com/docs/introduction/plans
  "activating a Neon compute from an idle state typically takes a few hundred
  milliseconds." https://neon.com/docs/connect/connection-latency
  The trigger is "no active queries for 5 minutes", so a live Game (a write
  every ≤40 s) keeps the compute awake; a Game idle in the lobby for 5
  minutes will pay one cold start on the next write.
  https://neon.com/docs/introduction/compute-lifecycle
  Gotcha: when the compute suspends, idle pooled connections are killed with
  "terminating connection due to administrator command". The `ws` server
  must attach `pool.on('error', …)` (an unhandled pool error crashes Node),
  set a short `idleTimeoutMillis`, and retry once.
  https://neon.com/docs/connect/connection-errors
  UNVERIFIED: whether an open, idle `pg` connection alone prevents suspend.
  The docs say the trigger is queries, not connections.
- Latency. Neon publishes "~3 round trips vs. ~8 for TCP" to first query for
  HTTP, and the 2023 blog claims same-region one-shot queries in "single-digit
  milliseconds". https://neon.com/docs/connect/choose-connection
  https://neon.com/blog/sub-10ms-postgres-queries-for-vercel-edge-functions
  A warm TCP pool skips the handshake entirely. Fly `iad` is Ashburn VA
  (https://fly.io/docs/reference/regions/), Neon `aws-us-east-1` is N.
  Virginia (https://neon.com/docs/introduction/regions); same metro, public
  internet in between. UNVERIFIED: the actual RTT; expect low single-digit
  ms, measure with `fly ssh console` + `psql \timing` in ticket 03's
  provisioning task.
- Pricing. Free: 100 CU-hours/project/month, 0.5 GB storage, max 2 CU,
  compute "suspended until the next billing period" if exceeded. Launch:
  $0.106/CU-hour, no minimum. https://neon.com/docs/introduction/plans
  "compute size × hours running = CU-hours".
  https://neon.com/docs/introduction/usage-metrics
  Live play adds awake time only: 3 h/evening × 30 days at 0.25 CU = 22.5
  CU-hours/month (inside Free; ≈ $2.40 on Launch). Always-on 0.25 CU ≈ 180
  CU-hours ≈ $19/month on Launch, not needed here.
  UNVERIFIED: which Neon plan the app is on today; the endpoint host does not
  say.
- Atomic claim in SQL. "When an index is declared unique, multiple table rows
  with equal indexed values are not allowed."
  https://www.postgresql.org/docs/current/indexes-unique.html
  `INSERT … ON CONFLICT DO NOTHING` "simply avoids inserting a row as its
  alternative action"; under Read Committed a concurrent insert of the same
  key means exactly one row lands and the loser reports 0 rows, no error.
  https://www.postgresql.org/docs/current/sql-insert.html
  https://www.postgresql.org/docs/current/transaction-iso.html
  Drizzle: `.onConflictDoNothing({ target: [...] })`.
  https://orm.drizzle.team/docs/insert
- Atomic verify in SQL. `SELECT … FOR UPDATE` on the Game row serialises
  claims for that Game ("prevents them from being locked, modified or deleted
  by other transactions until the current transaction ends"); or
  `pg_advisory_xact_lock(hash(game_id))`, auto-released at commit.
  https://www.postgresql.org/docs/current/explicit-locking.html
  https://www.postgresql.org/docs/current/functions-admin.html
  Drizzle: `db.transaction(async (tx) => …)`, with `isolationLevel` option.
  https://orm.drizzle.team/docs/transactions
- `LISTEN`/`NOTIFY` is not a fit for fan-out: direct connections only,
  in-memory, "no way to ensure that a message was delivered", and
  scale-to-zero "will terminate all listeners".
  https://neon.com/guides/pub-sub-listen-notify
- Neon's own gaming case study splits the work exactly as option 3 does:
  Durable Objects hold the live session, "Neon handles all persistent info."
  https://neon.com/blog/how-magic-circle-scaled-up-to-2m-games-with-cloudfare-and-neon

Verdict: as the durable layer, ideal (already paid for, transactional,
unique indexes do the claim for free). As the *only* layer, every broadcast
has to read state back or keep a cache, and the cache is option 3.

### 2. Upstash Redis as the hot store, Postgres for records

- Pricing (2026-09-01): Free $0, 256 MB, 500k commands/month, 10k
  commands/s, 1 database, "archived after a minimum of 30 days of
  inactivity". Pay-as-you-go $0.20 per 100k commands, first 1 GB storage
  free. Fixed 250 MB $10/month. https://upstash.com/pricing/redis
  https://upstash.com/docs/redis/overall/pricing
  https://upstash.com/docs/redis/help/faq
  At ~50k commands/month Free is enough; the risk is the 30-day archive if
  nobody plays for a month.
- Durability. "Every write operation is consistently stored in both memory
  and the block storage provided by cloud providers, such as AWS's EBS. Data
  is reloaded to memory from block storage in case of a server crash." Paid
  tiers add replicas; Free is implied single-instance.
  https://upstash.com/docs/redis/features/durability
  UNVERIFIED: whether the write is acknowledged before or after the disk
  write (the RPO). Consistency is eventual, single leader per key; strong
  consistency was deprecated. Causal consistency (read-your-writes) holds on
  one connection. https://upstash.com/docs/redis/features/consistency
- Latency: "Read latency from the same region <1ms", "Write latency from the
  same region <5ms" (p99). AWS `us-east-1` is available.
  https://upstash.com/docs/redis/features/globaldatabase
- Atomics. `MULTI`/`EXEC` "executed atomically"; `EVAL`/`SCRIPT LOAD`
  supported; `WATCH` is "not supported" over REST (UNVERIFIED over TCP).
  https://upstash.com/docs/redis/sdks/ts/commands/transaction
  https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval
  https://upstash.com/docs/redis/features/restapi
  Scripts default to a global lock; add `#!lua flags=allow-key-locking` so a
  claim script locks only its keys.
  https://upstash.com/docs/redis/features/key-locking
  The board claim does not even need a script: `SADD` is atomic and returns
  1 for new, 0 for existing.
- Access. From the Fly `ws` process, `ioredis` over TCP (`rediss://`, TLS
  cannot be disabled). From Vercel route handlers, `@upstash/redis` over
  REST. https://upstash.com/docs/redis/howto/connectclient
  https://upstash.com/docs/redis/howto/connectwithtls
  Max concurrent connections is not on the pricing page; the only published
  figure is a 2025 blog: "Max Concurrent Connections: Old 1k, New 10k" for
  all plans. UNVERIFIED as a doc statement.
  https://upstash.com/blog/limits-increase
- Fly's `fly redis create` provisions the same Upstash product, billed on
  the Fly invoice, reachable "via a private IPv6 address restricted to your
  Fly organization" at `redis://…@fly-<name>.upstash.io`. Vercel cannot reach
  it. https://fly.io/docs/upstash/redis/
  So the SSE fallback needs a direct Upstash database, not a Fly one.
- Eviction is off by default; writes are rejected at the size cap. Use TTLs
  on Game keys so ended Games expire.
  https://upstash.com/docs/redis/features/eviction
- Pub/sub: `SUBSCRIBE` works over TCP and as an SSE stream over REST. Redis
  pub/sub is at-most-once; Streams (`XADD`/`XREAD`) are persisted.
  https://upstash.com/docs/redis/features/restapi
  https://redis.io/docs/latest/develop/pubsub/

Verdict: a good store, but with a single `ws` process it solves a problem
the process does not have (cross-instance shared state), and it still needs
Postgres for anything you want to keep. Two stores, two consistency stories.
It earns its place only in the SSE fallback, as pub/sub.

### 3. In-memory on the `ws` server, write-through to Neon, rehydrate on boot

The Game object lives in a `Map<gameCode, Game>` in the process. Every
state transition is committed to Neon before it is acknowledged or
broadcast; on boot the server loads every Game in `lobby` or `playing`,
rebuilds the `Map`, and re-arms timers.

What Fly guarantees, which sets the rules:

- Deploys wipe memory. `rolling` (default) "One by one, each running Machine
  is taken down and replaced"; with one Machine, "any of those failures means
  downtime." `persist_rootfs` defaults to `never`: "The root filesystem is
  ephemeral and will not be persisted across restarts or updates."
  https://fly.io/docs/reference/configuration/#the-deploy-section
  https://fly.io/docs/blueprints/resilient-apps-multiple-machines/
  https://fly.io/docs/reference/configuration/#the-vm-section
  `bluegreen`/`canary` need two Machines, which for in-memory state means
  two owners; do not use them here.
- Graceful window. Fly sends `kill_signal` (default `SIGINT`), waits up to
  `kill_timeout` (default 5 s, max 300 s), then `SIGTERM`; "best-effort, and
  your app needs to be prepared to handle shorter stopping times."
  https://fly.io/docs/reference/configuration/#runtime-options
  Set `kill_signal = "SIGTERM"`, `kill_timeout = 30`, and in the handler:
  stop accepting, finish in-flight commits, send every socket a
  `server_restarting` frame, close. Since state is already written through,
  the handler has nothing to flush; it only makes reconnect faster.
- Crashes restart the process (`on-failure`, up to 10 retries in 5 minutes)
  with fresh memory. Host failure does not migrate: "If that host fails, the
  Machine goes down and does not automatically start again on another host."
  Recovery is `fly deploy` or scale down/up.
  https://fly.io/docs/reference/configuration/#the-restart-section
  https://fly.io/docs/apps/trouble-host-unavailable/
- Health checks only pull a Machine from routing; they never restart it. A
  hung process must exit itself to be restarted.
  https://fly.io/docs/reference/health-checks/
- Volumes are "tied to that hardware"; a host outage makes the volume
  unreachable. $0.15/GB-month. A SQLite-on-Volume design would survive
  deploys and crashes but not host loss, and adds LiteFS/Litestream to learn.
  Neon write-through covers all three cases with no new tool.
  https://fly.io/docs/volumes/overview/
- Autostop: `auto_stop_machines = "off"` or `min_machines_running = 1`;
  the proxy stops a Machine at "load 0", and with `concurrency.type =
  "connections"` open sockets count as load, but Fly does not state that
  WebSockets prevent autostop. PARTIALLY VERIFIED; setting it off makes the
  question moot.
  https://fly.io/docs/reference/fly-proxy-autostop-autostart/
  https://fly.io/docs/reference/configuration/#the-concurrency-section
- Machine cost in `iad`: shared-cpu-1x 256 MB $1.94/month, 512 MB
  $3.19/month, 1 GB $5.70/month, always on. No free tier.
  https://fly.io/docs/about/pricing/
  https://fly.io/docs/about/free-trial/

How the two atomic operations work here:

- Claim a Board. Handler runs synchronously: sample 16 cards, compute the
  canonical key (ticket 04: sorted card ids joined, or a hash of that), check
  `game.boardKeys.has(key)`, retry on hit, `add`. No `await` between check
  and add, so no interleaving. Then `INSERT INTO game_players … ON CONFLICT
  DO NOTHING`; if it returns 0 rows (only possible if a second process is
  somehow alive, or after a rehydrate raced a late write), remove the key
  from memory and resample. Reply to the Player only after the insert
  commits, so a crash between the two never leaves a Player holding a Board
  the database does not know about.
- Verify a win. Handler runs synchronously: `pattern.cells.every(c =>
  claim.marked.has(c) && game.called.has(board[c]))`. The call log in memory
  is never ahead of Postgres because a Call is inserted before it is added
  to `game.called` and broadcast. Simultaneous claims are serialised by the
  event loop and all evaluate against the same log; every verified claim
  gets a `game_wins` row and the Game moves to `ended` on the same tick.

Order of operations per Call (this is the whole latency story):

1. Caller presses next (or the timer fires).
2. `INSERT INTO game_calls (game_id, seq, card_id)` and `UPDATE games SET
   next_call_due_at, last_activity_at` in one transaction, one round trip
   (~1–5 ms same metro, UNVERIFIED).
3. Mutate memory, broadcast to ≤51 sockets, arm the next `setTimeout`.

Rehydrate on boot: `SELECT` Games where `status IN ('lobby','playing') AND
last_activity_at > now() - inactivity_window`, their Players and Calls; for
each Game with `next_call_due_at` in the past, fire the Call immediately;
otherwise arm the timer for the remaining time. Clients reconnect with
`gameCode + playerToken` (already specified in the map), receive a full
`sync` frame from memory, and continue.

Verdict: recommended. See below.

### 4. Cloudflare Durable Objects storage

Only relevant if ticket 03 flips the transport to Durable Objects
(`partyserver`), the runner-up in ticket 01. Then the state store comes
with it and is very good:

- "Each Durable Object has its own private, transactional, and strongly
  consistent storage"; "Each method is implicitly wrapped inside a
  transaction". SQLite-backed objects recommended for all new namespaces.
  https://developers.cloudflare.com/durable-objects/api/storage-api/
  https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/
- Input/output gates: no events are delivered while a storage op is in
  progress, and "outgoing network messages will be held back until the write
  has completed", so a client never sees an ack for a write that later
  fails. https://blog.cloudflare.com/durable-objects-easy-fast-correct-choose-three/
- Single-threaded per object, "soft limit of 1,000 requests per second"; 50
  Players per object is nowhere near it.
  https://developers.cloudflare.com/durable-objects/platform/limits/
- Durability: replicated to five followers, confirmed at three; 30-day
  point-in-time recovery. In-memory state is lost on eviction, crash, or
  deploy; "Deploying a new version restarts every Durable Object, which
  disconnects any existing connections."
  https://blog.cloudflare.com/sqlite-in-durable-objects/
  https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Alarms: one per object, at-least-once, stored via the Storage API so they
  outlive restarts. https://developers.cloudflare.com/durable-objects/api/alarms/
- Pricing: Free plan has SQLite-backed DOs with 100k requests/day, 5M rows
  read/day, 100k rows written/day, 5 GB stored; Paid ($5/month base) includes
  1M requests, 25B rows read, 50M rows written. Incoming WebSocket messages
  bill at 20:1. https://developers.cloudflare.com/durable-objects/platform/pricing/
- From Vercel: "Durable Objects do not receive requests directly from the
  Internet"; Next.js calls a Worker route you write.
  https://developers.cloudflare.com/durable-objects/get-started/

It does not change the picture for the Fly `ws` design: using DO storage
from Fly would mean an HTTPS hop to a Worker per event, which is slower and
costlier than a same-metro Postgres insert and teaches nothing. Note that
option 3 *is* the DO model (one single-threaded owner per Game, persisted
state, a re-armable timer) written by hand on top of Node and Postgres.
That is the learning argument in one sentence.

## Recommendation

**Option 3: the `ws` process holds each live Game in memory as the working
copy; Neon Postgres is the source of truth for durability, written through
before every acknowledgement; the process rehydrates from Postgres on
boot.** No Redis. No new accounts. One new driver (`pg`) and four new
tables.

Why, against the ticket's criteria:

1. Latency. One same-metro insert per Call, then an in-memory broadcast.
   Option 1 needs read-backs, option 2 adds a store to save at most a
   millisecond, option 4 is not reachable from Fly without a hop.
2. Consistency. Both atomic operations are a synchronous block on one event
   loop, which is the strongest and simplest guarantee available. The
   Postgres unique index on `(game_id, board_key)` is a backstop that also
   documents the invariant in the schema; `game_calls (game_id, card_id)`
   unique enforces "a card is called at most once per Game" the same way.
3. Survival. Deploys, crashes, and host loss all reduce to "rehydrate from
   Postgres, clients reconnect and resync". That path is exercised on every
   `fly deploy`, so it stays working. The only loss is an uncommitted
   in-flight event, and the Caller sees that (no ack) and presses again.
4. Cost. $0 beyond what the app already pays Neon; ~25k writes/month and
   ~20–25 extra compute-hours/month fit the Free plan's 100 CU-hours if that
   is the plan in use.
5. Learning. The owner writes the actor-per-Game state machine, the
   write-through discipline (commit, then mutate, then broadcast), the boot
   rehydration, and the SIGTERM handler. Those are the transferable ideas
   behind Durable Objects, Erlang processes, and every game server; here
   they are ~300 lines of plain TypeScript the owner can read end to end.

The trade-off, spelled out: correctness now depends on a rule the code
must never break, "no `await` between check and mutate, and commit before
ack". A refactor that inserts an `await` into the claim path reintroduces a
race that Postgres's unique index will catch but memory will not, which is
why the backstop stays. And because one process owns everything, the design
has a hard ceiling of one Machine; when that is exceeded, Games must be
sharded by Game Code across Machines (still no shared hot store needed),
which is a good problem to have at 20 concurrent Games.

Proposed durable shape (ticket 10 owns the final model; ticket 04 owns
`board_key`):

- `games`: `id`, `set_id` → `boards.id` (the code's `boards` table is a
  Set), `code`, `status` (`lobby` | `playing` | `ended`), `pattern`,
  `deck_order` (uuid[]), `auto_advance_seconds` (nullable),
  `next_call_due_at`, `last_activity_at`, `created_at`, `ended_at`.
- `game_players`: `id`, `game_id`, `nickname`, `device_token_hash`,
  `board_key`, `board_cards` (uuid[16], arranged order), `joined_at`;
  `UNIQUE (game_id, board_key)`, `UNIQUE (game_id, device_token_hash)`.
- `game_calls`: `game_id`, `seq`, `card_id`, `called_at`; `PRIMARY KEY
  (game_id, seq)`, `UNIQUE (game_id, card_id)`.
- `game_wins`: `game_id`, `player_id`, `call_seq`, `verified_at`.
- Marks: not stored. Ended Games: keep rows (history is out of scope for
  this map but cheap to retain); the inactivity sweeper flips `status` so
  codes recycle.

Wiring notes for ticket 03:

- The `ws` server connects with `pg.Pool({ connectionString: <pooled URL>,
  max: 5, idleTimeoutMillis: 30_000 })`, `pool.on('error', log)`, and
  `drizzle-orm/node-postgres` over the shared `db/schema.ts`. Next.js keeps
  `neon-http`. How the Fly Dockerfile gets `db/schema.ts` (same repo,
  `server/` directory, copy in the build) is a ticket 03 detail.
- Next.js on Vercel creates the `games` row (it already has the Set and the
  auth session), then calls the `ws` server's internal HTTP route to load
  it into memory. If the `ws` server is down, the Caller sees "game server
  unavailable" instead of a half-created Game.
- Measure Fly `iad` → Neon RTT during provisioning; if it is not low
  single-digit ms, nothing in this design changes, only the Call latency
  budget.

### What changes under the SSE + Upstash fallback

If ticket 03 picks the all-on-Vercel fallback (SSE route handlers +
Upstash Redis pub/sub), no single process owns a Game, so memory cannot be
the working copy and the arbitration moves back into Postgres: the claim is
`INSERT … ON CONFLICT DO NOTHING` (one statement, atomic without an
interactive transaction, which `neon-http` cannot do), verification is one
`neon().transaction([...])` batch or a single `INSERT INTO game_wins …
SELECT … WHERE NOT EXISTS (<pattern cell not in game_calls>)` statement,
and every event costs 2–3 Neon round trips instead of one. Upstash is then
needed only as the fan-out bus (`PUBLISH` from the route handler that
committed the event, `SUBSCRIBE` held open by each SSE stream) and must be
a direct Upstash database in `us-east-1`, not a Fly-provisioned one, since
Vercel cannot reach Fly's private network. The auto-advance timer moves to
an Inngest function (`step.sleepUntil(next_call_due_at)`, then call the
same "next card" server action), because no Vercel function lives longer
than `maxDuration`. Postgres stays the only store of record in both
designs, so the four tables above are unchanged.

## Not verified against a primary source

- Fly `iad` → Neon AWS `us-east-1` round-trip time (same metro, but neither
  vendor publishes a figure).
- Which Neon plan the app runs on, and therefore whether the extra
  compute-hours are free.
- Whether an open idle `pg` connection alone keeps a Neon compute awake.
- Upstash per-plan concurrent-connection cap (blog says 10k, docs silent),
  `WATCH` over TCP, and write-ack-vs-disk timing.
- Whether an open WebSocket counts as load for Fly autostop (moot with
  autostop off).
- Cloudflare: verbatim "alarms survive deploys" (implied by alarms living in
  storage) and whether the Free plan's 10 ms CPU cap applies inside a DO.
