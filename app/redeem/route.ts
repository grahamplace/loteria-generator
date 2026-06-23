import { NextRequest, NextResponse } from 'next/server';
import { SIGNUP_NUDGE_EXPIRY_DAYS } from '@/lib/constants';

/**
 * GET /redeem?code=LOTERIA-XXXX&boardId=... — stores the promo code in a
 * cookie and redirects to the board so the checkout route can auto-apply it.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const boardId = req.nextUrl.searchParams.get('boardId');
  const dest = boardId ? `/boards/${boardId}` : '/boards';
  const res = NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  if (code) {
    res.cookies.set('loteria_promo', code, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SIGNUP_NUDGE_EXPIRY_DAYS * 24 * 60 * 60,
    });
  }
  return res;
}
