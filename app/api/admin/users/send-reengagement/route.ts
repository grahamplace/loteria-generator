import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { inngest } from '@/lib/inngest/client';

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || !isAdminEmail(session.user.email)) {
    return new NextResponse('Not found', { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userIds } = body as { userIds?: unknown };

  if (
    !Array.isArray(userIds) ||
    userIds.length === 0 ||
    !userIds.every((id) => typeof id === 'string')
  ) {
    return NextResponse.json(
      { error: 'userIds must be a non-empty array of strings' },
      { status: 400 }
    );
  }

  await inngest.send({
    name: 'admin/reengagement-email.requested',
    data: { userIds },
  });

  return NextResponse.json({ queued: userIds.length });
}
