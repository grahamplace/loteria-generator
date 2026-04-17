'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db, cards } from '@/db';
import { and, eq } from 'drizzle-orm';
import { getClientSubscriptionToken } from 'inngest/react';
import { inngest } from '@/lib/inngest/client';
import { cardChannel, cardChannelTopics } from '@/lib/inngest/channels';

export async function getCardRealtimeToken(cardId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const card = await db.query.cards.findFirst({
    where: and(eq(cards.id, cardId), eq(cards.userId, session.user.id)),
  });

  if (!card) {
    throw new Error('Card not found');
  }

  return getClientSubscriptionToken(inngest, {
    channel: cardChannel({ cardId }),
    topics: [...cardChannelTopics],
  });
}
