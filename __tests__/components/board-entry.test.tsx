import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  ensure: vi.fn(),
  cookie: vi.fn(),
  redirect: vi.fn(),
  available: vi.fn(),
  profile: vi.fn(),
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: mocks.cookie }),
}));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('@/lib/boards/ensure-first-board', () => ({ ensureFirstBoard: mocks.ensure }));
vi.mock('@/db', () => ({
  db: {
    query: { boards: { findMany: mocks.available }, userProfiles: { findFirst: mocks.profile } },
  },
  userProfiles: {},
}));
vi.mock('@/components/theme-entry', () => ({ ThemeEntry: () => null }));

import StartPage from '@/app/[locale]/start/page';
import DashboardPage from '@/app/[locale]/dashboard/page';
import { ThemeEntry } from '@/components/theme-entry';
import { RECENT_BOARD_COOKIE } from '@/lib/boards/recent-board';
import { DEFAULT_BOARD_NAME } from '@/lib/constants';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: 'user', email: 'user@example.com' } });
  mocks.ensure.mockResolvedValue({ boardId: 'chosen', created: false, boardCount: 1 });
  mocks.cookie.mockReturnValue(undefined);
  mocks.profile.mockResolvedValue(null);
  mocks.redirect.mockImplementation((to) => {
    throw new Error(JSON.stringify(to));
  });
});
const props = (locale = 'en', query = {}) => ({
  params: Promise.resolve({ locale }),
  searchParams: Promise.resolve(query),
});

describe('consumer board entry', () => {
  it.each([0, 1, 3])('opens a board with %i boards before entry', async (count) => {
    mocks.ensure.mockResolvedValue({
      boardId: 'chosen',
      created: count === 0,
      boardCount: count || 1,
    });
    await expect(StartPage(props())).rejects.toThrow('/boards/chosen');
    expect(mocks.redirect).toHaveBeenLastCalledWith({ href: '/boards/chosen', locale: 'en' });
  });
  it('passes the remembered preference to the ownership-checked resolver', async () => {
    mocks.cookie.mockImplementation((name) =>
      name === RECENT_BOARD_COOKIE ? { value: 'remembered' } : undefined
    );
    await expect(StartPage(props('es-MX'))).rejects.toThrow('/boards/chosen');
    expect(mocks.ensure).toHaveBeenCalledWith(
      { id: 'user', email: 'user@example.com' },
      'remembered'
    );
    expect(mocks.redirect).toHaveBeenCalledWith({ href: '/boards/chosen', locale: 'es-MX' });
  });
  it('uses the existing sign-in loop breaker for an expired session', async () => {
    mocks.session.mockResolvedValue(null);
    await expect(StartPage(props('es-MX'))).rejects.toThrow('/sign-in');
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: { pathname: '/sign-in', query: { from: 'start' } },
      locale: 'es-MX',
    });
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
  it('respects saved locale on an ordinary entry', async () => {
    mocks.profile.mockResolvedValue({ locale: 'es-MX' });
    await expect(StartPage(props())).rejects.toThrow('es-MX');
    expect(mocks.redirect).toHaveBeenCalledWith({ href: '/start', locale: 'es-MX' });
  });
  it('preserves the explicit themed entry choice for existing work', async () => {
    mocks.available.mockResolvedValue([
      {
        id: 'work',
        name: 'Family',
        styleOptions: { presetId: 'birthday' },
        cards: [{ id: 'card' }],
      },
    ]);
    const result = await StartPage(props('es-MX', { theme: 'halloween', mode: 'original' }));
    expect(result?.type).toBe(ThemeEntry);
    expect(result?.props).toMatchObject({
      theme: 'halloween',
      photoMode: 'original',
      starterId: undefined,
      boards: [{ id: 'work', name: 'Family', cardCount: 1 }],
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('still configures an untouched starter for a themed signup', async () => {
    mocks.available.mockResolvedValue([
      { id: 'starter', name: DEFAULT_BOARD_NAME, styleOptions: null, cards: [] },
    ]);
    const result = await StartPage(props('en', { theme: 'halloween' }));
    expect(result?.props.starterId).toBe('starter');
  });
  it.each(['en', 'es-MX'])(
    'old dashboard URLs forward through the localized entry: %s',
    async (locale) => {
      await expect(DashboardPage({ params: Promise.resolve({ locale }) })).rejects.toThrow(
        '/start'
      );
      expect(mocks.redirect).toHaveBeenCalledWith({ href: '/start', locale });
    }
  );
});
