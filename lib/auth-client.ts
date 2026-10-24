import { createAuthClient } from 'better-auth/react';

// No baseURL: in the browser better-auth uses the page's own origin, so the
// same bundle talks to production, a Vercel preview, or localhost. Previews
// have no NEXT_PUBLIC_APP_URL, and the old localhost fallback broke them.
export const authClient = createAuthClient();

// Export convenient hooks and functions
export const { signIn, signUp, signOut, useSession, getSession } = authClient;
