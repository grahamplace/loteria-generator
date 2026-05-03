import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnlockPrompt } from '@/components/unlock-prompt';
import { BOARD_UNLOCK_PRICE_DISPLAY } from '@/lib/constants';

// Mock fetch for Stripe checkout
global.fetch = vi.fn();

// Mock next-intl with BoardEditor.UnlockPrompt messages
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      'BoardEditor.UnlockPrompt': {
        drawerTitleSrOnly: 'Unlock "{name}"',
        drawerDescSrOnly: 'Unlock this board for full access to all features.',
        dialogTitleSrOnly: 'Unlock "{name}"',
        dialogDescSrOnly: 'Unlock this board for full access to all features.',
        freeLimitReached: "You've reached the free limit",
        keepBuildingPrefix: 'Keep building —',
        keepBuildingSuffix: 'await',
        moreCards: '{count} more cards',
        featureCards: 'Up to 54 cards',
        featureExports: 'Unlimited exports',
        featureWatermarks: 'No watermarks',
        unlockButton: 'Unlock',
        redirectingButton: 'Redirecting…',
        maybeLater: 'Maybe later',
        'toasts.checkoutFailed': 'Failed to start checkout. Please try again.',
      },
    };
    const ns = messages[namespace] ?? {};
    const t = (key: string, params?: Record<string, unknown>) => {
      let val = ns[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          val = val.replace(`{${k}}`, String(v));
        }
      }
      return val;
    };
    t.raw = (key: string) => ns[key];
    t.rich = (key: string) => ns[key] ?? key;
    return t;
  },
}));

describe('UnlockPrompt', () => {
  const defaultProps = {
    boardId: 'test-board-123',
    boardName: 'Test Board',
    trigger: 'card_limit' as const,
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open is true', () => {
    render(<UnlockPrompt {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should display the price', () => {
    render(<UnlockPrompt {...defaultProps} />);

    expect(screen.getByText(BOARD_UNLOCK_PRICE_DISPLAY)).toBeInTheDocument();
  });

  it('should display the features list', () => {
    render(<UnlockPrompt {...defaultProps} />);

    expect(screen.getByText('Up to 54 cards')).toBeInTheDocument();
    expect(screen.getByText('Unlimited exports')).toBeInTheDocument();
    expect(screen.getByText('No watermarks')).toBeInTheDocument();
  });

  it('should show the free-limit headline regardless of trigger', () => {
    for (const trigger of ['card_limit', 'board_limit', 'export'] as const) {
      const { unmount } = render(<UnlockPrompt {...defaultProps} trigger={trigger} />);
      expect(screen.getByText(/You['']ve reached the free limit/i)).toBeInTheDocument();
      unmount();
    }
  });

  it('should call onOpenChange(false) when the dismiss button is clicked', () => {
    const onOpenChange = vi.fn();
    render(<UnlockPrompt {...defaultProps} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText(/maybe later/i));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should call the Stripe checkout endpoint when the unlock button is clicked', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/test' }),
    });

    const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    try {
      render(<UnlockPrompt {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /^unlock$/i }));

      expect(global.fetch).toHaveBeenCalledWith('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: 'test-board-123' }),
      });
    } finally {
      if (originalLocation) {
        Object.defineProperty(window, 'location', originalLocation);
      }
    }
  });
});
