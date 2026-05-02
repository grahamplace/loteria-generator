import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// next-intl's middleware imports next/server via ESM specifiers that Vitest
// can't resolve in the jsdom environment. Mock the whole module so the import
// in proxy.ts doesn't blow up; the tests only care about the auth-guard logic
// that runs before the intl middleware is called.
vi.mock('next-intl/middleware', () => ({
  default: () => () => NextResponse.next(),
}));

import { proxy } from '@/proxy';

function makeRequest(pathname: string, opts: { authed?: boolean } = {}) {
  const url = `http://localhost:3006${pathname}`;
  const req = new NextRequest(url);
  if (opts.authed) {
    req.cookies.set('better-auth.session_token', 'test-token');
  }
  return req;
}

describe('proxy locale-aware auth redirects', () => {
  it('redirects unauthenticated /es/dashboard to /es/sign-in with locale-prefixed callbackUrl', async () => {
    const res = await proxy(makeRequest('/es/dashboard'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    expect(location).toContain('/es/sign-in');
    expect(location).toContain('callbackUrl=%2Fes%2Fdashboard');
  });

  it('redirects unauthenticated /dashboard to /sign-in with non-prefixed callbackUrl', async () => {
    const res = await proxy(makeRequest('/dashboard'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    expect(location).toContain('/sign-in');
    expect(location).toContain('callbackUrl=%2Fdashboard');
    // Make sure no /es/ slipped in
    const path = new URL(location, 'http://localhost').pathname;
    expect(path).toBe('/sign-in');
  });

  it('redirects authenticated /es/sign-in to /es/dashboard', async () => {
    const res = await proxy(makeRequest('/es/sign-in', { authed: true }));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    const path = new URL(location, 'http://localhost').pathname;
    expect(path).toBe('/es/dashboard');
  });

  it('redirects authenticated /sign-in to /dashboard (no prefix)', async () => {
    const res = await proxy(makeRequest('/sign-in', { authed: true }));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    const path = new URL(location, 'http://localhost').pathname;
    expect(path).toBe('/dashboard');
  });

  it('blocks unauthenticated /api/boards with 401', async () => {
    const res = await proxy(makeRequest('/api/boards'));
    expect(res.status).toBe(401);
  });

  it('passes through /api/stripe/webhook unauthenticated', async () => {
    const res = await proxy(makeRequest('/api/stripe/webhook'));
    // Either 200 (NextResponse.next) or no redirect — confirm it's not a redirect/401
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(401);
  });
});
