'use server';

import { requireAdmin } from '@/lib/admin';
import { getClientSubscriptionToken } from 'inngest/react';
import { inngest } from '@/lib/inngest/client';
import { boardChannel, boardChannelTopics } from '@/lib/inngest/channels';

export async function getAdminBoardRealtimeToken(boardId: string) {
  await requireAdmin();
  return getClientSubscriptionToken(inngest, {
    channel: boardChannel({ boardId }),
    topics: [...boardChannelTopics],
  });
}
