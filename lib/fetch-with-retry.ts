/**
 * `fetch` that retries when the connection drops before any response arrives.
 *
 * Only network failures are retried — `fetch` rejects with a TypeError
 * ("Failed to fetch") for those. An HTTP error is a real answer from the
 * server and comes back as-is; an abort is deliberate and is rethrown.
 *
 * A dropped connection can still mean the server finished the request, so a
 * retried POST may occasionally create a duplicate. Callers accept that in
 * exchange for not losing the request to a Wi-Fi blip.
 */
export const DEFAULT_RETRY_DELAYS_MS = [1000, 3000];

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  { delaysMs = DEFAULT_RETRY_DELAYS_MS }: { delaysMs?: number[] } = {}
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (e) {
      if (!(e instanceof TypeError) || attempt >= delaysMs.length) throw e;
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
  }
}
