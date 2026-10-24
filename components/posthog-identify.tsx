'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { useSession } from '@/hooks/use-session';

/**
 * Ties the browser's PostHog person to the signed-in user. The email forms
 * identify on submit, but Google OAuth returns through a redirect that never
 * reaches that code, so without this those users stay anonymous in the
 * browser while server events (board_unlocked) land on their user id, and
 * their unlocks can't be traced back to the referrer that brought them.
 */
export function PostHogIdentify() {
  const { user } = useSession();

  useEffect(() => {
    if (!user) return;
    if (posthog.get_distinct_id() === user.id) return;
    posthog.identify(user.id, { email: user.email, name: user.name });
  }, [user?.id, user?.email, user?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
