# Live Game event protocol: versioned deltas over a role-scoped snapshot

Status: accepted (2026-09-02)

Builds on [ADR 0001](0001-live-game-realtime-architecture.md), which put an
in-memory working copy of each Game on one `ws` process with Neon Postgres as
the write-through source of truth. This ADR decides what actually crosses the
socket.

**Clients receive one role-scoped snapshot on connect, then deltas. Every
message that everyone can see carries a monotonically increasing Game version,
and the snapshot carries the version it was built at. Marks are the deliberate
exception: they go only to the Caller and do not touch the version.**

## The shape

- **Snapshot on connect, deltas after.** A full state push per Call would be a
  few KB × 54 Calls × 50 Players for no benefit. The snapshot is sent once per
  connection.
- **Role-scoped snapshots.** A Player gets Game state, Pattern, Call history,
  their own Board and Marks, the roster as names plus online flags, and the
  one-away list. The Caller additionally gets every Player's Board and Marks for
  the mini-board tray. A Player never receives another Player's Board — sending
  all of them would bloat the payload ~50× and put the room's Boards in any
  Player's devtools.
- **The Game version.** Every broadcast that all clients see — Calls, state
  transitions, joins, presence changes, Wins — carries `version`, and so does
  the snapshot. A client discards any event at or below its snapshot's version,
  and re-snapshots on a forward gap.
- **Marks are unversioned and Caller-only.** They travel as deltas
  (`playerId`, `cardId`, `marked`) to Caller connections.
- **One event per Call.** `call_made` carries the card id, the Call's sequence,
  the new version, the called count, the player count and the one-away list in
  one message.
- **The server computes, clients render.** Counts and the one-away list are
  derived server-side, never recomputed on the client.
- **Deadlines, not ticks.** `next_call_due_at` and the Claim Window deadline are
  published as absolute times with `server_now` beside them so clients can
  correct for clock offset. No per-second tick messages.
- **Cards are uuids** on the wire and in the database.
- **Persistence.** `games`, `game_players`, `game_calls`, `game_wins`. Calls and
  Wins are tables rather than array columns so the database can hold the
  uniqueness invariants.

## Why the version exists

It solves a specific race. A client connects; the server begins building its
snapshot at version 47; a Call fires and broadcasts version 48; the snapshot
arrives _after_ the event. Without versions the client applies the stale
snapshot over the newer event and renders a Board that is quietly wrong, with
nothing to detect it by. With them, the event is held or the snapshot is
refused, and the client converges.

TCP already guarantees ordered delivery on a live socket, so this is not about
lost frames. It is about the snapshot/event boundary, and about catching
server-side fan-out bugs — which ADR 0001 made more likely by allowing multiple
connections per identity.

## Why Marks do not bump it

Marks go only to the Caller. If a Mark bumped the shared counter, a Player would
watch the version jump 51 → 58 with no events in between, conclude it had missed
seven messages, and re-snapshot on every tap anyone in the room made. The
counter would actively cause the resyncs it exists to prevent.

Marks do not need sequencing on their own terms either: they are per-Player,
idempotent, and carried in full by the next snapshot, so a Caller who misses one
recovers on reconnect with no protocol machinery at all.

## Considered and rejected

- **Full state on every change.** Simplest to reason about and the reason many
  small realtime apps ship it, but it scales with Players × Calls and sends a
  Player fifty Boards they must not see.
- **A single version counter over everything, Marks included.** One concept
  instead of two, but it makes the Player's gap detector fire constantly. The
  asymmetry in the protocol is not an oversight; it follows from Marks having a
  narrower audience than everything else.
- **Per-connection sequence numbers** instead of a per-Game version. Detects
  gaps per socket, but says nothing about how a snapshot orders against a
  concurrent event — the actual race.
- **Server-driven countdown ticks.** 50 Players × one message per second of
  pure noise, and it makes the countdown hostage to network jitter.
- **Card `number` on the wire** instead of uuid, for ~10× smaller Board
  payloads. Rejected because nothing enforces it: `cards` has no unique index on
  `(board_id, number)`, so two cards in a Set can share a number today and a
  protocol keyed on it would mis-address a Board. Adding that constraint is a
  migration against live production data that may already violate it.
- **A persisted shuffled Deck order per Game.** Rejected as a second
  representation of a fact the Call log already holds; remaining cards are the
  Set's cards minus `game_calls`, which is correct after a restart without it.

## Consequences

- **Two classes of message exist**, versioned and unversioned, and the
  distinction has to stay visible in the code or someone will "fix" the
  asymmetry.
- **Snapshots are built per role**, so there are two serializers to keep in step
  with the delta events. A field added to one and forgotten in the other shows
  up only after a reconnect.
- **Clients hold no derivation logic**, which keeps them thin but means every
  new derived value on screen is a server change and a protocol change.
- **Clock offset correction is mandatory**, not a nicety: a countdown rendered
  against an uncorrected phone clock can start negative.
