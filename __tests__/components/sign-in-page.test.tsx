import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const signInEmail = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  signIn: { email: (...args: unknown[]) => signInEmail(...args), social: vi.fn() },
}));

vi.mock('posthog-js', () => ({
  default: { identify: vi.fn(), capture: vi.fn() },
}));

vi.mock('@/components/language-switch', () => ({
  LanguageSwitch: () => null,
}));

// Render the real English copy so the test proves what a user actually sees.
vi.mock('next-intl', async () => {
  const en = (await import('@/messages/en.json')).default;

  /** Look up a dotted key inside a dotted namespace of the real messages, falling back to the key itself. */
  function resolve(namespace: string, key: string): string {
    const path = [...namespace.split('.'), ...key.split('.')];
    let node: unknown = en;
    for (const part of path) {
      if (typeof node !== 'object' || node === null) return key;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === 'string' ? node : key;
  }

  return {
    useLocale: () => 'en',
    useTranslations: (namespace: string) => (key: string) => resolve(namespace, key),
  };
});

import SignInPage from '@/app/[locale]/(auth)/sign-in/page';

async function submitSignIn() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'whatever123' } });
  // Wrap the click in an async act() so the handler's post-await state
  // updates (setError / setIsLoading) flush before the test asserts,
  // instead of leaking into a later, unwrapped microtask tick.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sign-in page error handling', () => {
  it('renders localized copy instead of the upstream message', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: {
        status: 401,
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password',
      },
    });
    render(<SignInPage />);
    await submitSignIn();

    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
  });

  it('does not distinguish an unknown account from a wrong password', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' },
    });
    render(<SignInPage />);
    await submitSignIn();

    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
  });
});
