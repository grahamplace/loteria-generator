import { NextRequest, NextResponse } from 'next/server';
import {
  REENGAGEMENT_EXPIRY_DAYS,
  SIGNUP_NUDGE_EXPIRY_DAYS,
  NO_BOARD_EXPIRY_DAYS,
} from '@/lib/constants';

/** Longest-lived campaign code decides how long the promo cookie has to survive. */
const PROMO_COOKIE_DAYS = Math.max(
  SIGNUP_NUDGE_EXPIRY_DAYS,
  REENGAGEMENT_EXPIRY_DAYS,
  NO_BOARD_EXPIRY_DAYS
);

/**
 * GET /redeem?code=LOTERIA-XXXX&boardId=... — stores the promo code in a
 * cookie and redirects to the board so the checkout route can auto-apply it.
 *
 * Without a `boardId` this lands on `/start` rather than `/dashboard`: the
 * no-board campaign mails people who have zero boards, and `/dashboard` would
 * drop them on the empty state holding a discount code they can't spend.
 * `/start` is idempotent — it creates the missing board and routes straight
 * into it, and for anyone who already has boards it behaves as before.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const boardId = req.nextUrl.searchParams.get('boardId');
  const dest = boardId ? `/boards/${boardId}` : '/start';
  const res = NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  if (code) {
    res.cookies.set('loteria_promo', code, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: PROMO_COOKIE_DAYS * 24 * 60 * 60,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return res;
}
