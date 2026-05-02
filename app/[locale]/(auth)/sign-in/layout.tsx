import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to your Lotería Generator account to create custom Mexican Lotería cards from your photos.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/sign-in' },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
