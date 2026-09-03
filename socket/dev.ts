/**
 * Local dev entry point for the socket server.
 *
 * Exists only to load `.env.local` before anything else runs. On Fly the
 * secrets are already in the environment; locally they live in the file
 * `vercel env pull` writes, and nothing else would read it — `tsx` does not,
 * and `socket/index.ts` reads `process.env` at module scope to build the pool.
 *
 * The dynamic import is load-bearing: a static `import './index'` would hoist
 * above `loadEnvConfig` and the pool would be built with no DATABASE_URL.
 *
 * Not part of the production bundle — tsup builds `socket/index.ts` directly.
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  console.error('[socket] no DATABASE_URL — run `pnpm secrets:pull` first');
  process.exit(1);
}
if (!process.env.LIVE_GAME_TICKET_SECRET) {
  console.error('[socket] no LIVE_GAME_TICKET_SECRET — run `pnpm secrets:pull` first');
  process.exit(1);
}

// Not awaited: nothing follows it, and the import is evaluated at this point
// in the file rather than hoisted, which is the only ordering that matters.
void import('./index');
