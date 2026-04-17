import { describe, it, expect, vi } from 'vitest';
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

    // Processing state renders a pulsing skeleton where the label would go.
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    // And a spinner where the card buttons would go.
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

    // Error card renders a generic "Generation failed" heading; the specific
    // message is surfaced via tooltip/toast rather than inline text.
    expect(screen.getByText('Generation failed')).toBeInTheDocument();
  });

  it('should call onDeleteCard when delete button is clicked and confirmed', () => {
    const onDeleteCard = vi.fn();
    render(<BoardCardGrid {...defaultProps} onDeleteCard={onDeleteCard} />);

    // Click the delete button on the card to open the confirmation dialog
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    // Confirm deletion in the AlertDialog
    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    expect(onDeleteCard).toHaveBeenCalledWith('card-1');
  });

  it('should open edit modal when edit button is clicked', () => {
    render(<BoardCardGrid {...defaultProps} />);

    // Find and click the edit button for the first card
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    // The CardEditModal should be shown
    // We can check for the save button which is part of the modal
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('should hide action buttons when card is processing', () => {
    const processingCards = [
      {
        ...mockCards[0],
        isProcessing: true,
      },
    ];

    render(<BoardCardGrid {...defaultProps} cards={processingCards} />);

    // Processing cards omit Edit/Delete entirely to avoid interacting with a
    // card that's still being generated.
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });
});
