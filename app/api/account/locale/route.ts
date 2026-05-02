import { NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { userProfiles } from '@/db/schema';

const Body = z.object({ locale: z.enum(['en', 'es-MX']) });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  await db
    .update(userProfiles)
    .set({ locale: parsed.data.locale, updatedAt: new Date() })
    .where(eq(userProfiles.id, session.user.id));

  return new NextResponse(null, { status: 204 });
}
