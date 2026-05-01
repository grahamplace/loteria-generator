import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardCardGrid } from '@/components/board-card-grid';

describe('BoardCardGrid', () => {
  const mockCards = [
    {
      id: 'card-1',
      clientKey: 'card-1',
      number: 1,
      label: 'El Sol',
      illustration: 'data:image/png;base64,mock1',
      isProcessing: false,
    },
    {
      id: 'card-2',
      clientKey: 'card-2',
      number: 2,
      label: 'La Luna',
      illustration: 'data:image/png;base64,mock2',
      isProcessing: false,
    },
  ];

  const defaultProps = {
    cards: mockCards,
    onDeleteCard: vi.fn(),
    onUpdateLabel: vi.fn(),
    onReorderCards: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all cards', () => {
    render(<BoardCardGrid {...defaultProps} />);

    expect(screen.getByText('El Sol')).toBeInTheDocument();
    expect(screen.getByText('La Luna')).toBeInTheDocument();
  });

  it('should display card numbers', () => {
    render(<BoardCardGrid {...defaultProps} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should render nothing when cards array is empty', () => {
    const { container } = render(<BoardCardGrid {...defaultProps} cards={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('should show processing state', () => {
    const processingCards = [
      {
        ...mockCards[0],
        isProcessing: true,
        label: '',
      },
    ];

    const { container } = render(<BoardCardGrid {...defaultProps} cards={processingCards} />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should show error state', () => {
    const errorCards = [
      {
        ...mockCards[0],
        error: 'Failed to process card',
      },
    ];

    render(<BoardCardGrid {...defaultProps} cards={errorCards} />);

    expect(screen.getByText('Generation failed')).toBeInTheDocument();
  });

  it('should open the edit modal when a card is clicked', () => {
    render(<BoardCardGrid {...defaultProps} />);

    // The whole card is the click target — there's no separate edit button.
    fireEvent.click(screen.getByText('El Sol'));

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('should call onDeleteCard after the modal delete + confirmation flow', () => {
    const onDeleteCard = vi.fn();
    render(<BoardCardGrid {...defaultProps} onDeleteCard={onDeleteCard} />);

    // Open the edit modal for the first card.
    fireEvent.click(screen.getByText('El Sol'));

    // Hit Delete inside the modal — opens the confirmation AlertDialog.
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    // Confirm in the AlertDialog. Two "Delete" affordances exist now (the
    // modal's button, which still mounts behind the dialog, plus the alert's
    // confirm button); pick the one inside the alertdialog.
    const confirm = screen.getAllByRole('button', { name: /delete/i }).at(-1)!;
    fireEvent.click(confirm);

    expect(onDeleteCard).toHaveBeenCalledWith('card-1');
  });

  it('should hide the drag handle when a card is processing', () => {
    const processingCards = [
      {
        ...mockCards[0],
        isProcessing: true,
      },
    ];

    const { container } = render(<BoardCardGrid {...defaultProps} cards={processingCards} />);

    // Processing cards omit the drag-handle indicator entirely so users can't
    // try to interact with a card that isn't ready.
    expect(container.querySelector('[data-icon="grip-vertical"]')).toBeNull();
  });
});
