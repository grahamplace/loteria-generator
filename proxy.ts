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
  const canonicalPath = stripLocale(pathname);
  const isAuthenticated = !!getSessionToken(request);

  const isProtectedRoute = protectedRoutes.some((route) => canonicalPath.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => canonicalPath.startsWith(route));

  if (isProtectedRoute && !isAuthenticated) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
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
