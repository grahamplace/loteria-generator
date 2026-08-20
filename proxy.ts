import createNextIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { SIGN_IN_LOOP_BREAKER_PARAM, SIGN_IN_LOOP_BREAKER_VALUE } from '@/lib/safe-redirect';

const intlMiddleware = createNextIntlMiddleware(routing);

// Paths (without locale prefix) that require authentication.
// '/start' is the post-auth funnel: it needs a session to ensure a board, so an
// anonymous hit should bounce to sign-in rather than render.
const protectedRoutes = ['/dashboard', '/boards', '/account', '/start'];

// Paths (without locale prefix) that redirect to /start if already authenticated
const authRoutes = ['/sign-in', '/sign-up'];

// Top-level paths that live OUTSIDE the [locale] tree (e.g. their own route group
// with its own root layout, or a bare route handler like /redeem). next-intl
// middleware would otherwise rewrite these into the [locale] segment (e.g.
// /redeem → /en/redeem) where nothing resolves, producing a 404.
const nonLocalizedRoots = ['/admin', '/redeem', '/unsubscribe'];

// The URL prefix for Spanish is always '/es', even though the locale token is 'es-MX'.
const SPANISH_PREFIX = '/es';
const SPANISH_LOCALE = 'es-MX' as const;

/**
 * Whether the request carries a session cookie.
 *
 * NOTE: presence, not validity. The proxy runs at the edge and deliberately does
 * not hit the DB, so it cannot tell a live session from an expired or revoked
 * one. Everything here is a routing convenience; the real check happens in the
 * route/page via `auth.api.getSession()`.
 */
function getSessionToken(request: NextRequest): string | undefined {
  return (
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value
  );
}

/**
 * Strip the /es locale prefix from a pathname so auth guards can
 * compare against canonical paths like "/dashboard".
 */
function stripLocale(pathname: string): string {
  if (pathname === SPANISH_PREFIX) return '/';
  if (pathname.startsWith(`${SPANISH_PREFIX}/`)) return pathname.slice(SPANISH_PREFIX.length);
  return pathname;
}

/**
 * Detect the active locale from the URL pathname.
 * Returns the default locale when no explicit prefix is present
 * (consistent with `localePrefix: 'as-needed'`).
 */
function getLocale(pathname: string): (typeof routing.locales)[number] {
  if (pathname === SPANISH_PREFIX || pathname.startsWith(`${SPANISH_PREFIX}/`)) {
    return SPANISH_LOCALE;
  }
  return routing.defaultLocale; // 'en'
}

/**
 * Prepend a locale prefix to a path, unless the locale is the default
 * (no prefix needed when `localePrefix: 'as-needed'`).
 * Note: locale token 'es-MX' maps to URL prefix '/es'.
 */
function withLocale(path: string, locale: (typeof routing.locales)[number]): string {
  if (locale === routing.defaultLocale) return path;
  // locale is 'es-MX' → prepend '/es'
  return `${SPANISH_PREFIX}${path === '/' ? '' : path}`;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- API routes: apply auth guard only, skip intl routing ---
  if (pathname.startsWith('/api/')) {
    const isProtectedApiRoute =
      pathname.startsWith('/api/boards') ||
      pathname.startsWith('/api/account') ||
      (pathname.startsWith('/api/stripe') && !pathname.startsWith('/api/stripe/webhook'));
    if (isProtectedApiRoute && !getSessionToken(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // --- Non-localized roots: skip intl entirely so their own route group resolves ---
  if (nonLocalizedRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`))) {
    return NextResponse.next();
  }

  // --- Auth guard (runs before intl so redirects go to clean paths) ---
  const locale = getLocale(pathname);
  const canonicalPath = stripLocale(pathname);
  const isAuthenticated = !!getSessionToken(request);

  const isProtectedRoute = protectedRoutes.some((route) => canonicalPath.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => canonicalPath.startsWith(route));

  if (isProtectedRoute && !isAuthenticated) {
    const signInUrl = new URL(withLocale('/sign-in', locale), request.url);
    signInUrl.searchParams.set('callbackUrl', withLocale(canonicalPath, locale));
    return NextResponse.redirect(signInUrl);
  }

  // `/start` sets this when it found the session cookie to be stale — see
  // SIGN_IN_LOOP_BREAKER_PARAM. Without it, bouncing a cookie-bearing request
  // off /sign-in back to /start ping-pongs forever, because only /start can see
  // that the session is dead and only the proxy decides where /sign-in goes.
  const isReturningFromDeadSession =
    request.nextUrl.searchParams.get(SIGN_IN_LOOP_BREAKER_PARAM) === SIGN_IN_LOOP_BREAKER_VALUE;

  if (isAuthRoute && isAuthenticated && !isReturningFromDeadSession) {
    // '/start' rather than '/dashboard': it is idempotent (ensures the user has
    // a board) and drops a single-board user straight into their board.
    return NextResponse.redirect(new URL(withLocale('/start', locale), request.url));
  }

  // --- next-intl locale routing ---
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - api/auth (Better Auth handles its own routing)
     * - admin (the (admin) route group has no locale prefix; running
     *   next-intl's middleware here rewrites /admin → /en/admin which
     *   doesn't exist, producing a 404 before requireAdmin() can run)
     * - any path with a file extension (e.g. loteria-star.png, icon.ico,
     *   robots.txt, sitemap.xml). These live in /public and would otherwise
     *   be rewritten by next-intl's middleware to /<locale>/<file> and 404.
     */
    '/((?!_next/static|_next/image|api/auth|admin|.*\\..*).*)',
  ],
};
