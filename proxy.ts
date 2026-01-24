import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/boards', '/account'];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/sign-in', '/sign-up'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the session token from cookies
  // Better Auth stores session in a cookie named 'better-auth.session_token'
  const sessionToken = request.cookies.get('better-auth.session_token')?.value;
  const isAuthenticated = !!sessionToken;

  // Check if trying to access protected route without auth
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !isAuthenticated) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Check if trying to access auth routes while already authenticated
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Check protected API routes
  // Note: /api/stripe/webhook must be excluded - it's called by Stripe, not authenticated users
  const isProtectedApiRoute =
    pathname.startsWith('/api/boards') ||
    (pathname.startsWith('/api/stripe') && !pathname.startsWith('/api/stripe/webhook'));

  if (isProtectedApiRoute && !isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
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
