import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnlockPrompt } from '@/components/unlock-prompt';

// Mock fetch for Stripe checkout
global.fetch = vi.fn();

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

    // Check that the dialog title contains the board name
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should display the correct price', () => {
    render(<UnlockPrompt {...defaultProps} />);

    expect(screen.getByText('$5')).toBeInTheDocument();
  });

  it('should display features list', () => {
    render(<UnlockPrompt {...defaultProps} />);

    expect(screen.getByText('Up to 54 cards per board')).toBeInTheDocument();
    expect(screen.getByText('Unlimited board generations')).toBeInTheDocument();
    expect(screen.getByText('Full print-quality exports')).toBeInTheDocument();
    expect(screen.getByText('No watermarks')).toBeInTheDocument();
  });

  it('should show card limit message when trigger is card_limit', () => {
    render(<UnlockPrompt {...defaultProps} trigger="card_limit" />);

    expect(screen.getByText(/You've reached the free tier limit of 16 cards/)).toBeInTheDocument();
  });

  it('should show board limit message when trigger is board_limit', () => {
    render(<UnlockPrompt {...defaultProps} trigger="board_limit" />);

    expect(
      screen.getByText(/The free tier only allows 1 example board generation/)
    ).toBeInTheDocument();
  });

  it('should show export message when trigger is export', () => {
    render(<UnlockPrompt {...defaultProps} trigger="export" />);

    expect(
      screen.getByText(/Full exports are available with an unlocked board/)
    ).toBeInTheDocument();
  });

  it('should call onOpenChange when Continue with Free Preview is clicked', () => {
    const onOpenChange = vi.fn();
    render(<UnlockPrompt {...defaultProps} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText('Continue with Free Preview'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should call fetch when unlock button is clicked', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/test' }),
    });

    // Store original href setter
    const originalHref = Object.getOwnPropertyDescriptor(window, 'location');

    // Mock location.href setter
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    render(<UnlockPrompt {...defaultProps} />);

    fireEvent.click(screen.getByText(/Unlock for \$5/));

    expect(global.fetch).toHaveBeenCalledWith('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId: 'test-board-123' }),
    });

    // Restore original location
    if (originalHref) {
      Object.defineProperty(window, 'location', originalHref);
    }
  });
});
