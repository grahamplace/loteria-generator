import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { inngest } from '@/lib/inngest/client';
import { getCampaignTemplate } from '@/lib/email/campaigns/registry';

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

  const { templateKey, userIds } = body as { templateKey?: unknown; userIds?: unknown };

  if (typeof templateKey !== 'string' || !getCampaignTemplate(templateKey)) {
    return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
  }

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
    name: 'admin/campaign-email.requested',
    data: { templateKey, userIds },
  });

  return NextResponse.json({ queued: userIds.length });
}
