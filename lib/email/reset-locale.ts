// lib/email/reset-locale.ts
//
// better-auth composes the reset link itself and only hands `sendResetPassword`
// the finished URL, so the requested locale has to be read back out of the
// `callbackURL` query parameter the sign-in flow put there. Note the URL prefix
// for Spanish is `/es` even though the next-intl locale token is `es-MX`; the
// email templates use the shorter `'en' | 'es'` convention.

/**
 * Which language to send the reset email in, derived from the `callbackURL`
 * embedded in better-auth's reset URL. Defaults to `'en'` for anything missing
 * or unparseable — an English email is a far better failure mode than a throw
 * inside the send path.
 */
export function localeFromResetUrl(url: string): 'en' | 'es' {
  let callbackURL: string | null = null;
  try {
    callbackURL = new URL(url).searchParams.get('callbackURL');
  } catch {
    return 'en';
  }
  if (!callbackURL) return 'en';
  // searchParams.get() has already percent-decoded this value once — decoding
  // it again would throw URIError on a value containing a bare `%` (e.g. a
  // redirectTo of `/reset-password?x=100%`).
  return callbackURL === '/es' || callbackURL.startsWith('/es/') ? 'es' : 'en';
}
