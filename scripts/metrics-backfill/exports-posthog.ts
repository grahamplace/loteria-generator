/**
 * Recreates board_exports rows for exports that happened before the app
 * started recording them, from PostHog `board_exported` events.
 *
 * The events carry the user (distinct_id) and board name but no board id, so
 * each one is matched to the user's board with that name. When the name is
 * ambiguous or no longer exists, the export goes on the user's oldest board
 * and is logged — "this user exported" stays right even if the board is a guess.
 *
 * Usage:
 *   DATABASE_URL=… POSTHOG_PERSONAL_API_KEY=… pnpm backfill:exports [--dry-run]
 *
 * Environment:
 *   POSTHOG_PERSONAL_API_KEY  personal API key with query:read scope
 *   POSTHOG_PROJECT_ID        defaults to 405885
 *   POSTHOG_API_HOST          defaults to https://us.posthog.com
 *
 * Only imports events older than the first real (source='user') row, so it
 * never double-counts exports the app recorded itself. Re-running replaces
 * earlier backfilled rows.
 */

import { neon } from '@neondatabase/serverless';

const dryRun = process.argv.includes('--dry-run');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const sql = neon(requireEnv('DATABASE_URL'));
const apiKey = requireEnv('POSTHOG_PERSONAL_API_KEY');
const projectId = process.env.POSTHOG_PROJECT_ID ?? '405885';
const host = process.env.POSTHOG_API_HOST ?? 'https://us.posthog.com';

type ExportEvent = {
  distinctId: string;
  boardName: string | null;
  boardCount: number | null;
  cardCount: number | null;
  isUnlocked: boolean | null;
  timestamp: string;
};

async function fetchEvents(before: string | null): Promise<ExportEvent[]> {
  const cutoff = before ? `and timestamp < toDateTime('${before}')` : '';
  const query = `
    select distinct_id, properties.board_name, properties.board_count,
           properties.card_count, properties.is_unlocked, timestamp
    from events
    where event = 'board_exported' ${cutoff}
    order by timestamp
    limit 50000
  `;
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) throw new Error(`PostHog query failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { results: unknown[][] };

  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  return body.results.map(([distinctId, boardName, boardCount, cardCount, isUnlocked, ts]) => ({
    distinctId: String(distinctId),
    boardName: boardName ? String(boardName) : null,
    boardCount: num(boardCount),
    cardCount: num(cardCount),
    isUnlocked:
      isUnlocked === null || isUnlocked === undefined ? null : String(isUnlocked) === 'true',
    timestamp: String(ts),
  }));
}

async function main() {
  const [{ first }] = (await sql`
    select min(created_at) as first from board_exports where source = 'user'
  `) as { first: Date | null }[];
  // Postgres `timestamp` columns hold UTC wall-clock time.
  const before = first ? new Date(first).toISOString().replace('T', ' ').slice(0, 19) : null;

  const events = await fetchEvents(before);
  console.log(`${events.length} PostHog export events${before ? ` before ${before}` : ''}`);

  const boardRows = (await sql`
    select b.id, b.user_id, b.name, b.created_at
    from boards b
    where b.user_id = any(${[...new Set(events.map((e) => e.distinctId))]})
    order by b.created_at
  `) as { id: string; user_id: string; name: string; created_at: Date }[];

  const boardsByUser = new Map<string, typeof boardRows>();
  for (const b of boardRows) {
    boardsByUser.set(b.user_id, [...(boardsByUser.get(b.user_id) ?? []), b]);
  }

  // Re-running replaces the previous backfill wholesale rather than diffing it.
  if (!dryRun) {
    await sql`delete from board_exports where source = 'posthog_backfill'`;
  }

  let inserted = 0;
  let guessed = 0;
  let skippedNoUser = 0;
  for (const e of events) {
    const userBoards = boardsByUser.get(e.distinctId);
    if (!userBoards?.length) {
      skippedNoUser++; // anonymous distinct_id, or the user/boards were deleted
      continue;
    }

    const createdAt = new Date(e.timestamp);
    const named = userBoards.filter((b) => b.name === e.boardName);
    const board = named.length === 1 ? named[0] : userBoards[0];
    if (named.length !== 1) {
      guessed++;
      console.warn(
        `  ${e.distinctId}: "${e.boardName}" matched ${named.length} boards; using ${board.id}`
      );
    }

    if (!dryRun) {
      await sql`
        insert into board_exports (board_id, user_id, source, board_count, card_count, was_unlocked, created_at)
        values (${board.id}, ${e.distinctId}, 'posthog_backfill', ${e.boardCount}, ${e.cardCount}, ${e.isUnlocked}, ${createdAt})
      `;
    }
    inserted++;
  }

  console.log(
    `${dryRun ? 'Would insert' : 'Inserted'} ${inserted} exports ` +
      `(${guessed} board guesses, ${skippedNoUser} events with no matching user).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
