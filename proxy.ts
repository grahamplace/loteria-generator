import createNextIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createNextIntlMiddleware(routing);

// Paths (without locale prefix) that require authentication
const protectedRoutes = ['/dashboard', '/boards', '/account'];

// Paths (without locale prefix) that redirect to dashboard if already authenticated
const authRoutes = ['/sign-in', '/sign-up'];

function getSessionToken(request: NextRequest): string | undefined {
  return (
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value
  );
}

/**
 * Strip a locale prefix (/en or /es) from a pathname so auth guards can
 * compare against canonical paths like "/dashboard".
 */
function stripLocale(pathname: string): string {
  const pattern = new RegExp(`^/(${routing.locales.join('|')})(/.+|$)`);
  const m = pathname.match(pattern);
  if (m) return m[2] || '/';
  return pathname;
}

/**
 * Detect the active locale from the URL pathname.
 * Returns the default locale when no explicit prefix is present
 * (consistent with `localePrefix: 'as-needed'`).
 */
function getLocale(pathname: string): (typeof routing.locales)[number] {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return routing.defaultLocale;
}

/**
 * Prepend a locale prefix to a path, unless the locale is the default
 * (no prefix needed when `localePrefix: 'as-needed'`).
 */
function withLocale(path: string, locale: (typeof routing.locales)[number]): string {
  if (locale === routing.defaultLocale) return path;
  return `/${locale}${path === '/' ? '' : path}`;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- API routes: apply auth guard only, skip intl routing ---
  if (pathname.startsWith('/api/')) {
    const isProtectedApiRoute =
      pathname.startsWith('/api/boards') ||
      (pathname.startsWith('/api/stripe') && !pathname.startsWith('/api/stripe/webhook'));
    if (isProtectedApiRoute && !getSessionToken(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL(withLocale('/dashboard', locale), request.url));
  }

  // --- next-intl locale routing ---
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/auth (auth endpoints need to be accessible)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)',
  ],
};
