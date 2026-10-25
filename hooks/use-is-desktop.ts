'use client';

import { useSyncExternalStore } from 'react';

/** Matches Tailwind's `lg` breakpoint, where the board page shows its preview sidebar. */
const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribe(notify: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}

export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  );
}
