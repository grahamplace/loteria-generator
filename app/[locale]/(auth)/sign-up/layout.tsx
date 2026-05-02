import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up',
  description:
    'Create a free Lotería Generator account and start turning your photos into custom Mexican Lotería cards.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/sign-up' },
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
