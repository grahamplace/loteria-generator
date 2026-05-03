#!/usr/bin/env tsx
/**
 * Deletes a Neon branch by id, or all stale e2e-* branches.
 *
 * Usage:
 *   tsx scripts/e2e-branch-destroy.ts <branch-id>
 *   tsx scripts/e2e-branch-destroy.ts --all-stale
 *
 * "Stale" means: name starts with "e2e-" AND created_at older than 1 hour.
 */

export {};

const NEON_API = 'https://console.neon.tech/api/v2';
const STALE_AGE_MS = 60 * 60 * 1000;

interface NeonBranch {
  id: string;
  name: string;
  created_at: string;
}

async function neonFetch<T>(
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${NEON_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 404) return null as T;
  if (!res.ok) {
    const body = await res.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string };
      detail = parsed.message ?? parsed.error ?? body;
    } catch {
      // body wasn't JSON
    }
    throw new Error(`Neon API ${path} ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

async function deleteBranch(
  apiKey: string,
  projectId: string,
  branchId: string
): Promise<void> {
  await neonFetch<unknown>(apiKey, `/projects/${projectId}/branches/${branchId}`, {
    method: 'DELETE',
  });
  process.stderr.write(`deleted ${branchId}\n`);
}

async function deleteAllStale(apiKey: string, projectId: string): Promise<void> {
  const { branches } = await neonFetch<{ branches: NeonBranch[] }>(
    apiKey,
    `/projects/${projectId}/branches`
  );
  const cutoff = Date.now() - STALE_AGE_MS;
  const stale = branches.filter(
    (b) => b.name.startsWith('e2e-') && new Date(b.created_at).getTime() < cutoff
  );
  process.stderr.write(`found ${stale.length} stale branch(es)\n`);
  for (const branch of stale) {
    try {
      await deleteBranch(apiKey, projectId, branch.id);
    } catch (err) {
      process.stderr.write(
        `failed to delete ${branch.id}: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  }
}

async function main(): Promise<void> {
  const apiKey = requireEnv('NEON_API_KEY');
  const projectId = requireEnv('NEON_PROJECT_ID');

  const arg = process.argv[2];
  if (!arg) throw new Error('Usage: e2e-branch-destroy.ts <branch-id> | --all-stale');

  if (arg === '--all-stale') {
    await deleteAllStale(apiKey, projectId);
    return;
  }
  await deleteBranch(apiKey, projectId, arg);
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
