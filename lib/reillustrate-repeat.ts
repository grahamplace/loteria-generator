const STORAGE_KEY = 'card-reillustrated-at';

/**
 * A second re-illustrate of the same card inside this window suggests the
 * first result ignored the notes. Reported to PostHog as `is_repeat`.
 */
export const REPEAT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Records a re-illustrate of `cardId` in this tab and returns whole seconds
 * since the previous one, or null if there was none (or storage is blocked).
 */
export function recordReillustrate(cardId: string, now: number = Date.now()): number | null {
  try {
    const times = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>;
    const previous = times[cardId];
    times[cardId] = now;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(times));
    return typeof previous === 'number' ? Math.floor((now - previous) / 1000) : null;
  } catch {
    return null;
  }
}
