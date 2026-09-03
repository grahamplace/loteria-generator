# Live play spec

Status: decided, not built (2026-09-02)

Every architecture decision for live Lotería play is locked. This document is
the single entry point for a build session: it says what was decided and where
the reasoning lives. It is a summary with pointers — a decision lives in exactly
one place, its ticket, and this file never restates the argument.

Vocabulary is `CONTEXT.md`'s. Set, Card, Deck, Board, Game, Game Code, Caller,
Player, Call, Mark, Claim, Win, Claim Window, Pattern. The code's `boards` table
is a Set; that legacy naming is deliberately not being changed here.

Route map: `.scratch/live-game/map.md`. Tickets: `.scratch/live-game/issues/`.

---

## 1. What the feature is

A Caller starts a Game from a Set they own and have unlocked, provided it holds
more than 16 cards. Players join from their phones with a six-digit Game Code
and a nickname — no account. Each Player is dealt a Board no other Player holds.
The Caller draws cards one at a time, manually or on a timer; Players tap to
Mark the cards they hold. The first Player to complete the Game's Pattern and
claim it wins, verified by the server.

---

## 2. Architecture

**ADR: [`docs/adr/0001-live-game-realtime-architecture.md`](adr/0001-live-game-realtime-architecture.md)**
· ticket: _Decide realtime transport, hosting, and state store_

Our own Node `ws` server on one always-on Fly.io Machine in `iad`, with an
in-memory working copy of each Game. Neon Postgres is the source of truth,
written through on every change and rehydrated on boot. Next.js on Vercel is the
control plane.

- **Postgres is the only Vercel↔Fly interface.** There is no HTTP between them.
  "Play" is a Next.js server action that validates ownership, unlock state and
  card count, generates the Code, and inserts the `games` row as `lobby`. The
  `ws` server materialises the Game on the first socket that names its Code. If
  Fly is down, "Play" still creates the Game — the page just cannot connect yet.
- **Handshake auth is a short-lived HMAC ticket.** The socket is on a different
  origin, so the better-auth cookie does not ride along. Next.js mints a ~60s
  ticket (`gameCode`, `role`, `playerId`) with Node's `crypto`; the `ws` server
  verifies it offline against a shared secret. Exactly one place in the system
  understands better-auth.
- **Arbitration is the event loop.** One process owns every Game, so
  check-and-set with no `await` between cannot interleave. This is what removed
  Redis from the design.
- **Database driver:** `pg` + `drizzle-orm/node-postgres` on the pooled
  connection string — _not_ `@neondatabase/serverless`, whose HTTP driver has no
  transaction support. `pool.on('error', …)` is mandatory; an unhandled pool
  error crashes Node. `idleTimeoutMillis` is **long** (10 min): measured warm
  queries are 2–3 ms while a reconnect costs 25–400 ms, so a short timeout would
  make nearly every Call pay a TLS handshake. See ADR 0001's amendment.
- **Code location:** `socket/` in the root package, bundled with tsup.
  `Dockerfile` and `fly.toml` at the repo root. A third process in `pnpm dev`.

Scaling past one instance is **out of scope** and a future decision, not a
config change.

---

## 3. Infrastructure

Ticket: _Provision the Fly.io socket service and wire the secrets_ — **already
done**, not pending work.

- Fly app **`loteria-live-game`** (`iad`), one shared-cpu-1x 512 MB Machine.
  **Deploy with `fly deploy --ha=false`** — Fly's HA default creates a second
  machine, which breaks single-arbiter arbitration. See ADR 0001.
  `fly.toml` at the repo root: `min_machines_running = 1`,
  `auto_stop_machines = "off"`, `kill_signal = "SIGTERM"` with a 30s drain so
  open sockets close cleanly, `/health` check. **Created but never deployed** —
  there is nothing to run yet.
- Neon is on the **Launch** plan with **scale-to-zero off** on the production
  branch, so the long-lived pool cannot be dropped mid-Game.
- Secrets: `LIVE_GAME_TICKET_SECRET` and the pooled production `DATABASE_URL`
  are staged on Fly. `LIVE_GAME_TICKET_SECRET` and `NEXT_PUBLIC_WS_URL` are set
  across Vercel production / preview / development. Production and preview share
  the ticket secret with Fly; development has its own. See `AGENTS.md`.
- Re-runnable provisioning wizard: `.scratch/live-game/provision-fly.sh`.

---

## 4. Data model

Ticket: _Game data model and event protocol_

Four tables, following `db/schema.ts` conventions (`uuid().defaultRandom()`,
status as `text().$type<Union>()`, `timestamp()` without timezone, snake_case).

| Table          | Key columns                                                                                                                                        | Unique                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `games`        | `board_id` (the Set), `code`, `status`, `pattern`, `joins_locked`, `auto_advance_seconds`, `next_call_due_at`, `claim_window_closes_at`, `version` | `code`                                        |
| `game_players` | `player_token`, `nickname`, `board_card_ids uuid[]` (ordered), `board_key`, `marked_card_ids uuid[]`, `last_seen_at`                               | `(game_id, board_key)`, `(game_id, nickname)` |
| `game_calls`   | `card_id`, `sequence`, `called_at`                                                                                                                 | `(game_id, card_id)`, `(game_id, sequence)`   |
| `game_wins`    | `player_id`, `pattern_instance`, `won_on_sequence`                                                                                                 | `(game_id, player_id)`                        |

Calls and Wins are **tables, not array columns**, so the database can hold the
invariants ADR 0001 asked it to: a card is Called at most once per Game, and a
Player wins at most once. Boards and Marks are arrays on the Player row.

---

## 5. Event protocol

**ADR: [`docs/adr/0002-live-game-event-protocol.md`](adr/0002-live-game-event-protocol.md)**
· ticket: _Game data model and event protocol_

One role-scoped snapshot on connect, deltas thereafter. Every message everyone
can see carries a **Game version**, and so does the snapshot, so a client can
discard an event older than its snapshot and re-snapshot on a forward gap.

**Marks are the deliberate exception: Caller-only, and unversioned.** If a Mark
bumped the shared counter, Players would see version jumps with no events and
re-snapshot on every tap anyone made.

Other rules: one event per Call carrying its derived counts and the one-away
list together · the server computes every derived value, clients only render ·
deadlines are published as absolute times with `server_now` for clock-offset
correction, never per-second ticks · cards are uuids on the wire · a Player
never receives another Player's Board.

The full event and command catalogue is in the ticket's Answer.

---

## 6. Rules of play

### Boards

Ticket: _Board assignment and uniqueness enforcement_

A Board is **16 card ids in order** — the same cards in a different arrangement
is a _different_ Board, because positional Patterns are arrangement-sensitive.
`board_key` = SHA-256 of the ordered ids.

Assignment is lazy at join: shuffle the Set's cards, take the first 16, and that
order _is_ the arrangement. Server-chosen, so a tampered client cannot
re-arrange to reach a row sooner. Collision → redraw; the event loop arbitrates,
the unique index backstops.

Capacity is a flat **50**. P(n,16) never binds — even a 17-card Set has 3.6×10¹⁴
distinct Boards. The real small-Set problem is Board _similarity_, handled with
a lobby advisory ("17 cards — every Board will be nearly identical") rather than
assignment logic.

### Patterns and winning

Ticket: _Win patterns catalog and verification rules_

Six Patterns, thirteen instances over cells 0–15. A static table in code, keyed
by an English id; display names through i18n.

| Pattern      | Instances | Cells                                            |
| ------------ | --------- | ------------------------------------------------ |
| Full board   | 1         | all 16                                           |
| Any row      | 4         | `0-3`, `4-7`, `8-11`, `12-15`                    |
| Any column   | 4         | `0,4,8,12`, `1,5,9,13`, `2,6,10,14`, `3,7,11,15` |
| Any diagonal | 2         | `0,5,10,15`, `3,6,9,12`                          |
| Four corners | 1         | `0,3,12,15`                                      |
| Centre       | 1         | `5,6,9,10`                                       |

One Pattern per Game, fixed at creation. **A Win requires every cell of one
instance to be both Called and Marked** — paying attention is the game; an idle
tab must not win.

The **one-away feed reads Calls only**, so a Player can be shown one away having
marked nothing. The feed measures the Board's luck; the Win measures the
Player's attention. Do not blur this in the copy.

### The Claim Window

The first verified Win **freezes Calls**. Everyone who wins inside the window
wins; there is no second place and no tiebreak.

- **Auto-advance: 20 seconds**, with a visible countdown on both views.
- **Manual: open until the Caller taps "End game."**

A failed Claim names the reason — _"those cards haven't all been called"_ or
_"you haven't marked every card in the pattern"_ — but **never the cells**,
which would make the button a cheat sheet. Private to the claimant, no penalty,
~2s server-side cooldown.

### The Deck

Each Call draws at random from the Set's cards minus `game_calls`. No shuffled
order is persisted; rehydrate after a restart is correct without one.

---

## 7. Lifecycle

Ticket: _Game Code format and lifecycle_

**Game Code: six digits**, never reused. Digits over letters because letter
_names_ diverge between English and Spanish and the room is bilingual. Generated
by random draw + `INSERT … ON CONFLICT DO NOTHING`, 5 retries. Past ~500k Games,
start recycling Codes from Games ended more than 30 days ago.

**URLs:** `/play` for typed entry, `/play/482913` as the deep link, **always
shared unprefixed** so next-intl's existing detection in `proxy.ts` lands each
Player in their own language. `/play/*` must stay out of `proxy.ts`'s
`protectedRoutes`.

**States:** `lobby` → `playing` → `ended`. A lobby that never starts expires 2
hours after creation; a `playing` Game with no Call for 60 minutes ends.
Deck exhaustion opens a Claim Window like a Win does, then ends.

**One active Game per Set.** A second is refused with Resume / End, never a
silent takeover.

**Join errors are specific** — not found / ended / full, each with a next step.
Validation lives in the ticket-minting server action, rate-limited per IP. There
is no public lookup endpoint; that is the thing that got brute-forced at
Jackbox.

---

## 8. Presence and reconnection

Ticket: _Reconnection and presence semantics_

**Marks are server-side.** Streamed on each tap, stored as an array on the
Player row, written through per Mark. Still honor-system — the Game records
every Mark without judging it. A Claim carries nothing; the server verifies
against its own copy.

**Nobody is ever dropped.** A Board reservation lasts the life of the Game. The
count reads **"12 players · 2 offline"**, never a number that silently shrinks.
Disconnected = two missed heartbeats; `ws` ping every 25s, dead at ~55s.

**Caller disconnect** halts auto-advance and shows "Waiting for the caller…",
becoming "The caller hasn't come back" at 5 minutes. That mark changes the
_copy_, not the state — the Game still ends on the 60-minute rule, so a Caller
whose wifi died walks back into a live Game.

**Identity is the device token.** Nicknames are mutable labels, unique within
the Game, and renaming never costs a Player their seat.

**Many connections, one identity**, all with equal rights — losing a tab is
never losing your seat. Marks and Calls must fan out to _every_ connection for
an identity. This is what lets a Caller cast a laptop to the TV and draw from
their phone at the same time.

A Player reconnecting after the Game ended lands on the result screen.

---

## 9. The two views

Prototypes live on branch **`prototype/player-board`** — the full variant sets
are the primary source. They were written under prototype constraints and get
rewritten when folded in.

### Player board — ticket _Prototype: Player board on a phone_, Variant A

The Board is the page. A slim top strip carries the Pattern and the counts; the
last Called card is a **corner chip, not a hero** — the Player hears the Caller,
the phone is for the Board. ¡Lotería! is a fixed bottom bar. Every tile carries
its card name; a Mark dims the tile _and_ drops a bean, two cues rather than
colour alone.

**The Board never shows which cards have been Called.** Highlighting them would
hand the Player the answer and turn marking into clerical work.

### Caller view — ticket _Prototype: Caller view_

**One responsive view, two layouts.** At large widths, Variant A "Stage": built
to be cast, card enormous, Code prominent, Call history a thumbnail strip, and
**player Boards behind a toggle, off by default**. At phone widths, Variant C
"Phone remote": one narrow column, Draw at thumb height, Players and History
behind tabs.

The toggle exists because **a cast screen is a public screen** — a permanently
visible mini-board tray shows every Player's Board to the whole room. The tray
is genuinely useful to the Caller; its default just has to be hidden.

**The Caller holds no Board and cannot Claim.** There is no ¡Lotería! button
anywhere on the Caller's screen.

Controls the Caller view owns: Start game, Draw next, auto-advance interval
(manual / 4s / 6s / 8s), Lock joins, End game.

---

## 10. Open for the build session

Decided nothing about these; they are listed so nobody assumes they were missed.

- **Spectator / TV view** — whether one is needed at all, now that the Caller's
  large-width layout is built to be cast. What would remain is a controls-free
  variant of the same screen.
- **How live play is measured.** `game_created` and `player_joined` are captured
  from the Next.js server actions, both attributed to the Caller's user id —
  Players are anonymous, so a per-player distinct id would mint a throwaway
  profile never seen again.

  Deliberately **not** captured: `card_called`, `win_verified`, `game_ended`.
  Two reasons. At ~54 Calls a Game the first is noise, and all three already
  live in Postgres with more detail than an event would carry, so PostHog would
  be a lossy duplicate. More importantly it would put a network dependency
  inside the one process whose job is to be a reliable single arbiter.

  Completion and win data is a query, not an event:

  ```sql
  select g.status, g.end_reason,
         count(distinct p.id)  as players,
         count(distinct c.id)  as calls,
         count(distinct w.id)  as winners,
         g.ended_at - g.started_at as duration
  from games g
  left join game_players p on p.game_id = g.id
  left join game_calls   c on c.game_id = g.id
  left join game_wins    w on w.game_id = g.id
  group by g.id;
  ```

- **Where "Play" lives** on the existing Set page, and whether unlock upsell
  copy mentions play.
- ~~How e2e reaches a socket server~~ — **decided: a real one, per run.**
  `playwright.config.ts` starts it alongside `next dev`, against the same
  throwaway Neon branch. No new CI secret: the ticket secret only has to match
  between the process that mints and the one that verifies, and both are ours,
  so it is a fixed dummy exactly like `STRIPE_WEBHOOK_SECRET`.

  A stub was rejected because it is precisely the half that cannot fail.
  Everything interesting lives in the handshake — a ticket that will not verify,
  a snapshot that never arrives, a Player the cached Game has never heard of.

- **Fly `iad` → Neon `us-east-1` RTT**, and whether Fly's proxy idle timeouts
  interfere with open sockets. Both need a running Machine, so they were
  deferred out of provisioning to the first build ticket.
- **Spanish Pattern names** need a native review before shipping. They are
  traditional terms (_tabla llena_, _cuatro esquinas_, _el pozo_), not
  translations to guess at. The same applies to the card names used in the
  prototypes, which came off filenames.

## Out of scope

Ruled beyond this effort, not forgotten: renaming `boards` → sets · game
history, replay, a public gallery, monetising play · Callers who are not the Set
owner · scaling the socket server past one instance · the print exporter's board
generation.
