#!/usr/bin/env tsx
/**
 * Creates an ephemeral Neon branch from the test-base branch.
 * Prints a single line of JSON to stdout: { branchId, databaseUrl }.
 */

const NEON_API = 'https://console.neon.tech/api/v2';

interface NeonBranch {
  id: string;
  name: string;
  current_state: string;
}

interface NeonEndpoint {
  id: string;
  branch_id: string;
  host: string;
  type: string;
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
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Neon API ${path} ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

async function main(): Promise<void> {
  const apiKey = requireEnv('NEON_API_KEY');
  const projectId = requireEnv('NEON_PROJECT_ID');
  const parentBranchId = requireEnv('NEON_TEST_BASE_BRANCH_ID');

  const shortSha = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
  const attempt = process.env.GITHUB_RUN_ATTEMPT ?? '0';
  const ts = Date.now();
  const branchName = `e2e-${shortSha}-${attempt}-${ts}`;

  const created = await neonFetch<{ branch: NeonBranch; endpoints: NeonEndpoint[] }>(
    apiKey,
    `/projects/${projectId}/branches`,
    {
      method: 'POST',
      body: JSON.stringify({
        branch: { name: branchName, parent_id: parentBranchId },
        endpoints: [{ type: 'read_write' }],
      }),
    }
  );

  const branchId = created.branch.id;

  const start = Date.now();
  while (Date.now() - start < 30_000) {
    const { branch } = await neonFetch<{ branch: NeonBranch }>(
      apiKey,
      `/projects/${projectId}/branches/${branchId}`
    );
    if (branch.current_state === 'ready') break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const password = await getRolePassword(apiKey, projectId, branchId);

  const endpoint = created.endpoints.find((e) => e.type === 'read_write');
  if (!endpoint) throw new Error('No read_write endpoint returned by Neon');

  const databaseUrl =
    `postgresql://neondb_owner:${password}@${endpoint.host}/neondb` +
    `?sslmode=require`;

  process.stdout.write(JSON.stringify({ branchId, databaseUrl }) + '\n');
}

async function getRolePassword(
  apiKey: string,
  projectId: string,
  branchId: string
): Promise<string> {
  const { password } = await neonFetch<{ password: string }>(
    apiKey,
    `/projects/${projectId}/branches/${branchId}/roles/neondb_owner/reveal_password`
  );
  return password;
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
