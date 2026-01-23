'use client';

import { useSession as useBetterAuthSession } from '@/lib/auth-client';

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

export interface Session {
  user: SessionUser;
  expires: string;
}

/**
 * Hook to get the current user session
 * Wraps Better Auth's useSession for convenience
 */
export function useSession() {
  const { data, isPending, error } = useBetterAuthSession();

  return {
    session: data?.session
      ? {
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            image: data.user.image,
          },
          expires: data.session.expiresAt?.toString() || '',
        }
      : null,
    user: data?.user
      ? {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          image: data.user.image,
        }
      : null,
    isLoading: isPending,
    isAuthenticated: !!data?.session,
    error,
  };
}
