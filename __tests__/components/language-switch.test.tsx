import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

const replace = vi.fn();
let mockLocale = 'en';
const usePathnameMock = vi.fn(() => '/dashboard');

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => usePathnameMock(),
}));
vi.mock('next-intl', () => ({
  useLocale: () => mockLocale,
}));

// Polyfill PointerEvent for jsdom so Radix UI opens on pointerdown
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventPolyfill });
  Object.defineProperty(window.HTMLElement.prototype, 'hasPointerCapture', { value: vi.fn() });
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { value: vi.fn() });
  Object.defineProperty(window.HTMLElement.prototype, 'releasePointerCapture', { value: vi.fn() });
  Object.defineProperty(window.HTMLElement.prototype, 'setPointerCapture', { value: vi.fn() });
}

// Import AFTER mocks and polyfills are set up
import { LanguageSwitch } from '@/components/language-switch';

const fetchMock = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', fetchMock);

/** Open the LanguageSwitch dropdown using the pointer events Radix listens for. */
function openDropdown() {
  const trigger = screen.getByRole('button', { name: /change language/i });
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.click(trigger);
}

describe('<LanguageSwitch />', () => {
  beforeEach(() => {
    replace.mockReset();
    fetchMock.mockClear();
    usePathnameMock.mockReturnValue('/dashboard');
    mockLocale = 'en';
    document.cookie = 'LOCALE=; max-age=0; path=/;';
  });

  it('switches locale on click', async () => {
    render(<LanguageSwitch />);
    openDropdown();
    fireEvent.click(await screen.findByRole('menuitem', { name: /español/i }));

    expect(replace).toHaveBeenCalledWith('/dashboard', { locale: 'es' });
    expect(document.cookie).toContain('LOCALE=es');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/locale',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('does not navigate when current locale is selected', async () => {
    render(<LanguageSwitch />);
    openDropdown();
    fireEvent.click(await screen.findByRole('menuitem', { name: /english/i }));

    expect(replace).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks the active locale on the menu item', async () => {
    mockLocale = 'es';
    render(<LanguageSwitch />);
    openDropdown();
    const esItem = await screen.findByRole('menuitem', { name: /español/i });
    expect(esItem.getAttribute('data-active')).toBe('true');
  });

  it('survives a failing /api/account/locale POST silently', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    render(<LanguageSwitch />);
    openDropdown();
    fireEvent.click(await screen.findByRole('menuitem', { name: /español/i }));

    // Cookie was still set, navigation still happened.
    expect(document.cookie).toContain('LOCALE=es');
    expect(replace).toHaveBeenCalled();
  });
});
