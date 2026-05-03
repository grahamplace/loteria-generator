#!/usr/bin/env tsx
/**
 * Orchestrates an E2E run end-to-end:
 *   1. Create Neon branch (via e2e-branch-create.ts)
 *   2. drizzle-kit migrate
 *   3. seed test user
 *   4. run Playwright
 *   5. destroy branch (always)
 *
 * Reads env from .env.test if present, otherwise from process.env.
 * Exits with Playwright's exit code.
 */

import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';

/** Kill any process listening on a port so Playwright can start a fresh server. */
function freePort(port: number): void {
  if (process.env.E2E_SKIP_PORT_FREE === '1') {
    process.stderr.write(`E2E_SKIP_PORT_FREE=1; leaving port ${port} alone\n`);
    return;
  }
  // lsof -ti :<port> prints PIDs listening on that port; kill them gracefully.
  const result = spawnSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' });
  const pids = (result.stdout ?? '').trim().split('\n').filter(Boolean);
  for (const pid of pids) {
    process.stderr.write(`killing process ${pid} on port ${port}…\n`);
    spawnSync('kill', ['-TERM', pid]);
  }
  if (pids.length > 0) {
    // Brief pause so the port is released before Playwright tries to bind it.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
}

if (existsSync('.env.test')) {
  loadDotenv({ path: '.env.test' });
}

interface BranchInfo {
  branchId: string;
  databaseUrl: string;
}

function run(
  cmd: string,
  args: string[],
  opts: SpawnSyncOptions = {}
): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(cmd, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...opts,
  });
  if (result.error) throw result.error;
  return {
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
    status: result.status ?? 1,
  };
}

function runInherit(cmd: string, args: string[], env: NodeJS.ProcessEnv): number {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function destroyBranch(branchId: string): Promise<void> {
  process.stderr.write(`destroying branch ${branchId}…\n`);
  const res = run('pnpm', ['exec', 'tsx', 'scripts/e2e-branch-destroy.ts', branchId]);
  process.stderr.write(res.stderr);
  if (res.status !== 0) {
    process.stderr.write(`branch destroy failed (status ${res.status}); leak GC will catch it\n`);
  }
}

async function main(): Promise<number> {
  process.stderr.write('creating Neon branch…\n');
  const create = run('pnpm', ['exec', 'tsx', 'scripts/e2e-branch-create.ts']);
  process.stderr.write(create.stderr);
  if (create.status !== 0) {
    process.stderr.write('branch creation failed\n');
    return 1;
  }
  const branch = JSON.parse(create.stdout.trim()) as BranchInfo;
  process.stderr.write(`branch ${branch.branchId} ready\n`);

  let exitCode = 1;
  let branchDestroyed = false;

  const cleanup = async (): Promise<void> => {
    if (branchDestroyed) return;
    branchDestroyed = true;
    await destroyBranch(branch.branchId);
  };

  process.on('SIGINT', () => {
    void cleanup().finally(() => process.exit(130));
  });
  process.on('SIGTERM', () => {
    void cleanup().finally(() => process.exit(143));
  });

  try {
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: branch.databaseUrl,
      BETTER_AUTH_SECRET:
        process.env.E2E_BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET ?? '',
    };

    process.stderr.write('running migrations…\n');
    const migrateStatus = runInherit('pnpm', ['db:migrate'], childEnv);
    if (migrateStatus !== 0) return migrateStatus;

    process.stderr.write('seeding test user…\n');
    const seedStatus = runInherit('pnpm', ['exec', 'tsx', 'scripts/e2e-seed-user.ts'], childEnv);
    if (seedStatus !== 0) return seedStatus;

    // Ensure Playwright can start a fresh server with the correct DATABASE_URL.
    // A dev server may already be running on this port pointing at the wrong DB.
    freePort(3006);

    process.stderr.write('running Playwright…\n');
    exitCode = runInherit('pnpm', ['exec', 'playwright', 'test'], childEnv);
    return exitCode;
  } finally {
    await cleanup();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
