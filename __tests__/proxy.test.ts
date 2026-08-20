import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// next-intl's middleware imports next/server via ESM specifiers that Vitest
// can't resolve in the jsdom environment. Mock the whole module so the import
// in proxy.ts doesn't blow up; the tests only care about the auth-guard logic
// that runs before the intl middleware is called.
vi.mock('next-intl/middleware', () => ({
  default: () => () => NextResponse.next(),
}));

import { proxy, config } from '@/proxy';

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

  // Authenticated users on an auth route funnel through /start, not /dashboard:
  // /start is idempotent (ensures a board) and drops a single-board user into
  // their board.
  it('redirects authenticated /es/sign-in to /es/start', async () => {
    const res = await proxy(makeRequest('/es/sign-in', { authed: true }));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    const path = new URL(location, 'http://localhost').pathname;
    expect(path).toBe('/es/start');
  });

  it('redirects authenticated /sign-in to /start (no prefix)', async () => {
    const res = await proxy(makeRequest('/sign-in', { authed: true }));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    const path = new URL(location, 'http://localhost').pathname;
    expect(path).toBe('/start');
  });

  it('redirects authenticated /es/sign-up to /es/start', async () => {
    const res = await proxy(makeRequest('/es/sign-up', { authed: true }));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    const path = new URL(location, 'http://localhost').pathname;
    expect(path).toBe('/es/start');
  });

  it('redirects authenticated /sign-up to /start (no prefix)', async () => {
    const res = await proxy(makeRequest('/sign-up', { authed: true }));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    const path = new URL(location, 'http://localhost').pathname;
    expect(path).toBe('/start');
  });

  it('redirects unauthenticated /start to /sign-in with a callbackUrl', async () => {
    const res = await proxy(makeRequest('/start'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    const url = new URL(location, 'http://localhost');
    expect(url.pathname).toBe('/sign-in');
    expect(url.searchParams.get('callbackUrl')).toBe('/start');
  });

  it('redirects unauthenticated /es/start to /es/sign-in with a locale-prefixed callbackUrl', async () => {
    const res = await proxy(makeRequest('/es/start'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    const url = new URL(location, 'http://localhost');
    expect(url.pathname).toBe('/es/sign-in');
    expect(url.searchParams.get('callbackUrl')).toBe('/es/start');
  });

  it('lets an authenticated /start request through to intl routing', async () => {
    const res = await proxy(makeRequest('/start', { authed: true }));
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(401);
  });

  // Loop breaker. The proxy can only see that a session COOKIE EXISTS — it can't
  // tell a live session from an expired/revoked one. /start is where the token
  // is actually validated, so when it comes back dead /start redirects to
  // /sign-in?from=start. Without the exemption below, the proxy would bounce
  // that right back to /start and the pair would ping-pong until the browser
  // gives up with ERR_TOO_MANY_REDIRECTS.
  it('does NOT bounce a cookie-bearing /sign-in?from=start back to /start', async () => {
    const res = await proxy(makeRequest('/sign-in?from=start', { authed: true }));
    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
  });

  it('does NOT bounce a cookie-bearing /es/sign-in?from=start back to /es/start', async () => {
    const res = await proxy(makeRequest('/es/sign-in?from=start', { authed: true }));
    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
  });

  it('still bounces a cookie-bearing /sign-in carrying an unrelated param', async () => {
    const res = await proxy(makeRequest('/sign-in?from=elsewhere', { authed: true }));
    expect(res.status).toBe(307);
    const path = new URL(res.headers.get('location')!, 'http://localhost').pathname;
    expect(path).toBe('/start');
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

describe('proxy matcher', () => {
  // Compile the exported matcher string into a RegExp so we can verify which
  // request paths trigger the proxy. The (admin) route group has no locale
  // prefix, so running next-intl on /admin would rewrite it to /en/admin and
  // 404 before requireAdmin() can check the session.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it('excludes /admin so the (admin) route group bypasses next-intl', () => {
    expect(matcher.test('/admin')).toBe(false);
    expect(matcher.test('/admin/users')).toBe(false);
    expect(matcher.test('/admin/boards/abc-123')).toBe(false);
  });

  it('still matches application paths that need locale handling', () => {
    expect(matcher.test('/dashboard')).toBe(true);
    expect(matcher.test('/es/dashboard')).toBe(true);
    expect(matcher.test('/sign-in')).toBe(true);
  });
});
