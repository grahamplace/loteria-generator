#!/usr/bin/env tsx
/**
 * Deletes the Neon branches the Vercel integration creates for preview
 * deploys (named `preview/<git branch>`). Nothing else removes them, so each
 * PR left one behind in the main project.
 *
 * Usage:
 *   tsx scripts/preview-branch-cleanup.ts <git-branch>
 *   tsx scripts/preview-branch-cleanup.ts --sweep
 *
 * `--sweep` deletes every `preview/*` branch older than 7 days whose git
 * branch is not in OPEN_PR_BRANCHES (newline-separated head branch names).
 * The age floor spares branches pushed without a PR yet.
 */

export {};

const NEON_API = 'https://console.neon.tech/api/v2';
const PREFIX = 'preview/';
const SWEEP_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface NeonBranch {
  id: string;
  name: string;
  created_at: string;
  default: boolean;
}

async function neonFetch<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${NEON_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Neon API ${path} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function previewBranches(apiKey: string, projectId: string): Promise<NeonBranch[]> {
  const { branches } = await neonFetch<{ branches: NeonBranch[] }>(
    apiKey,
    `/projects/${projectId}/branches?limit=400`
  );
  return branches.filter((b) => b.name.startsWith(PREFIX) && !b.default);
}

async function deleteBranches(
  apiKey: string,
  projectId: string,
  branches: NeonBranch[]
): Promise<number> {
  let failures = 0;
  for (const branch of branches) {
    try {
      await neonFetch<unknown>(apiKey, `/projects/${projectId}/branches/${branch.id}`, {
        method: 'DELETE',
      });
      process.stderr.write(`deleted ${branch.name} (${branch.id})\n`);
    } catch (err) {
      failures++;
      process.stderr.write(
        `failed to delete ${branch.name}: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  }
  return failures;
}

async function main(): Promise<void> {
  const apiKey = requireEnv('NEON_API_KEY');
  const projectId = requireEnv('NEON_PROJECT_ID');

  const arg = process.argv[2];
  if (!arg) throw new Error('Usage: preview-branch-cleanup.ts <git-branch> | --sweep');

  const branches = await previewBranches(apiKey, projectId);
  let targets: NeonBranch[];
  if (arg === '--sweep') {
    const open = new Set(
      (process.env.OPEN_PR_BRANCHES ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const cutoff = Date.now() - SWEEP_MIN_AGE_MS;
    targets = branches.filter(
      (b) => !open.has(b.name.slice(PREFIX.length)) && new Date(b.created_at).getTime() < cutoff
    );
  } else {
    targets = branches.filter((b) => b.name === `${PREFIX}${arg}`);
  }

  process.stderr.write(`found ${targets.length} preview branch(es) to delete\n`);
  if (process.env.DRY_RUN) {
    for (const b of targets) process.stderr.write(`would delete ${b.name}\n`);
    return;
  }
  if ((await deleteBranches(apiKey, projectId, targets)) > 0) process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
