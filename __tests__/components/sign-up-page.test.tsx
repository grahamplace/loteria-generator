import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const signUpEmail = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
  signIn: { social: vi.fn() },
}));

vi.mock('posthog-js', () => ({
  default: { identify: vi.fn(), capture: vi.fn() },
}));

vi.mock('@/lib/google-ads', () => ({
  fireSignupConversion: vi.fn(),
  setPendingSignupConversion: vi.fn(),
  clearPendingSignupConversion: vi.fn(),
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

import SignUpPage from '@/app/[locale]/(auth)/sign-up/page';

// The exact shape better-auth 1.6.9 returns for a duplicate sign-up.
const DUPLICATE_EMAIL_RESULT = {
  data: null,
  error: {
    status: 422,
    code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
    message: 'User already exists. Use another email.',
  },
};

async function submitSignUp() {
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'taken@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'TestPassword123!' },
  });
  // Wrap the click in an async act() so the handler's post-await state
  // updates (setError / setIsLoading) flush before the test asserts,
  // instead of leaking into a later, unwrapped microtask tick.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sign-up page error handling', () => {
  it('never renders better-auth’s account-existence message', async () => {
    signUpEmail.mockResolvedValue(DUPLICATE_EMAIL_RESULT);
    render(<SignUpPage />);
    await submitSignUp();

    await waitFor(() => {
      expect(screen.getByText(/we couldn’t create your account/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/use another email/i)).not.toBeInTheDocument();
  });

  it('shows the same message for an unrelated server failure', async () => {
    signUpEmail.mockResolvedValue({
      data: null,
      error: { status: 500, message: 'Internal Server Error' },
    });
    render(<SignUpPage />);
    await submitSignUp();

    await waitFor(() => {
      expect(screen.getByText(/we couldn’t create your account/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/internal server error/i)).not.toBeInTheDocument();
  });

  it('shows the rate-limit message on 429', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { status: 429 } });
    render(<SignUpPage />);
    await submitSignUp();

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });
  });
});
