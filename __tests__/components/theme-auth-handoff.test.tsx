import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({
  callback: '/es/start?theme=halloween&mode=original',
  social: vi.fn(),
  push: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: state.push }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'callbackUrl' ? state.callback : null),
  }),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
    createElement('a', { href }, children),
}));
vi.mock('@/lib/auth-client', () => ({
  signUp: { email: vi.fn() },
  signIn: { email: vi.fn(), social: state.social },
}));
vi.mock('@/components/language-switch', () => ({ LanguageSwitch: () => null }));
vi.mock('posthog-js', () => ({ default: { identify: vi.fn(), capture: vi.fn() } }));
vi.mock('@/lib/google-ads', () => ({
  fireSignupConversion: vi.fn(),
  setPendingSignupConversion: vi.fn(),
  clearPendingSignupConversion: vi.fn(),
}));
vi.mock('next-intl', async () => {
  const en = (await import('@/messages/en.json')).default;
  return {
    useLocale: () => 'es-MX',
    useTranslations: (namespace: string) => (key: string) => {
      let value: unknown = en;
      for (const part of [...namespace.split('.'), ...key.split('.')])
        value = (value as Record<string, unknown>)[part];
      return value;
    },
  };
});
import SignUpPage from '@/app/[locale]/(auth)/sign-up/page';
import SignInPage from '@/app/[locale]/(auth)/sign-in/page';

beforeEach(() => {
  vi.clearAllMocks();
  state.callback = '/es/start?theme=halloween&mode=original';
  state.social.mockResolvedValue({});
});
describe.each([
  ['signup', SignUpPage],
  ['signin', SignInPage],
] as const)('%s theme handoff', (_name, Page) => {
  it('passes locale, theme and original-photo mode into Google OAuth', async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /google/i }));
    await waitFor(() =>
      expect(state.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: state.callback })
    );
  });
  it('keeps the themed callback on the alternate authentication link', () => {
    render(<Page />);
    const alternate = screen
      .getAllByRole('link')
      .find((link) => link.getAttribute('href')?.includes('callbackUrl='));
    expect(decodeURIComponent(alternate?.getAttribute('href') ?? '')).toContain(state.callback);
  });
  it('rejects an external callback for Google authentication', async () => {
    state.callback = 'https://untrusted.example/start';
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /google/i }));
    await waitFor(() =>
      expect(state.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/es/start' })
    );
  });
});
