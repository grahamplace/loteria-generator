import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeByToken } from '@/lib/email/unsubscribe';

/**
 * POST /api/unsubscribe?token=... — one-click unsubscribe.
 *
 * Targeted by the RFC 8058 `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
 * header (Gmail/Yahoo bulk-sender requirement) and by the confirmation page's
 * fallback form. Always returns 200 so a mailbox provider's one-click probe
 * never surfaces an error to the user; the body reports whether it matched.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const { ok } = await unsubscribeByToken(token);
  return NextResponse.json({ unsubscribed: ok }, { status: 200 });
}
