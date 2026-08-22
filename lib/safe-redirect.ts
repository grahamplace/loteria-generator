/**
 * Open-redirect guard for untrusted `callbackUrl` values.
 *
 * The proxy sets `?callbackUrl=` when it bounces an unauthenticated visitor off
 * a protected route, and the sign-in page sends the user there after a
 * successful sign-in. That value arrives from the URL bar, so an attacker can
 * put anything in it — `https://evil.example/phish`, `//evil.example`,
 * `/\evil.example` — and, if we redirect blindly, we hand them a phishing link
 * that starts on our own domain and lands on theirs, right after the user typed
 * a password. So: accept only a same-origin *relative path*, and fall back to a
 * known-good path for everything else.
 *
 * Deliberately dependency-free and framework-agnostic so it can be unit-tested
 * and reused from client components, server components, and the proxy alike.
 */

/** Where an untrusted callback lands when it fails validation. */
export const DEFAULT_SAFE_REDIRECT = '/start';

/**
 * Loop-breaker marker for the sign-in page.
 *
 * `proxy.ts` runs at the edge and can only check whether a session *cookie
 * exists* — it cannot validate the token. "Cookie present" is therefore not the
 * same as "session valid", and the two diverge routinely: sessions expire
 * (7-day `expiresIn`) or get revoked while the cookie is still sitting in the
 * browser.
 *
 * That asymmetry closes a cycle:
 *   `/start` (cookie present → proxy waves it through) → `getSession()` returns
 *   null → `/sign-in` → proxy sees the same cookie, treats it as authenticated,
 *   bounces auth routes to `/start` → … → ERR_TOO_MANY_REDIRECTS.
 *
 * `/start` appends `?from=start` when it discovers the session is actually dead,
 * and the proxy skips its auth-route bounce for requests carrying it. The user
 * reaches the sign-in form, signs in, and gets a fresh cookie.
 *
 * Worst case if someone hand-types the param while genuinely signed in: they see
 * the sign-in form instead of being redirected. No access is granted by it — it
 * only suppresses a convenience redirect — so it is safe as an unsigned marker.
 */
export const SIGN_IN_LOOP_BREAKER_PARAM = 'from';
export const SIGN_IN_LOOP_BREAKER_VALUE = 'start';

/** Any C0 control character, DEL, or a raw newline/tab smuggled into the value. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/**
 * Sanitize an untrusted redirect target into a safe same-origin relative path.
 *
 * Accepted: a path beginning with exactly one `/`, optionally carrying a query
 * string and/or hash (`/boards/abc`, `/boards/abc?x=1`, `/es/boards/abc`).
 *
 * Rejected (returns `fallback`):
 * - absolute URLs — `http://…`, `https://…`, or any `scheme:` form
 * - protocol-relative URLs — `//evil.example` (browsers treat these as absolute)
 * - backslash tricks — `/\evil.example` (browsers normalize `\` to `/`, so this
 *   is protocol-relative in disguise); any backslash at all is rejected, since
 *   a legitimate path never contains one
 * - anything that does not start with `/` (bare hosts, `javascript:` payloads)
 * - control characters, which can be used to split headers or dodge filters
 * - empty / whitespace-only / non-string values
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_SAFE_REDIRECT
): string {
  if (typeof candidate !== 'string') return fallback;

  // Trim first: leading whitespace is ignored by browsers when resolving a URL,
  // so " //evil.example" must be judged as "//evil.example".
  const value = candidate.trim();

  if (value.length === 0) return fallback;
  if (CONTROL_CHARS.test(value)) return fallback;
  if (value.includes('\\')) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;

  return value;
}
