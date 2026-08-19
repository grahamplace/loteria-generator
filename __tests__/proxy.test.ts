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

  it('redirects an authenticated user away from /forgot-password', async () => {
    const res = await proxy(makeRequest('/forgot-password', { authed: true }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!, 'http://localhost').pathname).toBe('/dashboard');
  });

  it('redirects an authenticated user away from /es/forgot-password to the Spanish dashboard', async () => {
    const res = await proxy(makeRequest('/es/forgot-password', { authed: true }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!, 'http://localhost').pathname).toBe(
      '/es/dashboard'
    );
  });

  it('lets a signed-out user reach /forgot-password', async () => {
    const res = await proxy(makeRequest('/forgot-password'));
    expect(res.status).not.toBe(307);
  });

  it('lets an authenticated user reach /reset-password so an emailed link still works', async () => {
    const res = await proxy(makeRequest('/reset-password?token=tok1', { authed: true }));
    expect(res.status).not.toBe(307);
  });

  it('lets a signed-out user reach /reset-password', async () => {
    const res = await proxy(makeRequest('/reset-password?token=tok1'));
    expect(res.status).not.toBe(307);
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
