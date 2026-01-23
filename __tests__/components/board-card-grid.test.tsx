import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardCardGrid } from '@/components/board-card-grid';

describe('BoardCardGrid', () => {
  const mockCards = [
    {
      id: 'card-1',
      number: 1,
      label: 'El Sol',
      illustration: 'data:image/png;base64,mock1',
      isProcessing: false,
    },
    {
      id: 'card-2',
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
        label: 'Processing...',
      },
    ];

    render(<BoardCardGrid {...defaultProps} cards={processingCards} />);

    // Should find multiple "Processing..." texts - one in the spinner and one in the label
    const processingTexts = screen.getAllByText('Processing...');
    expect(processingTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('should show error state', () => {
    const errorCards = [
      {
        ...mockCards[0],
        error: 'Failed to process card',
      },
    ];

    render(<BoardCardGrid {...defaultProps} cards={errorCards} />);

    expect(screen.getByText('Failed to process card')).toBeInTheDocument();
  });

  it('should call onDeleteCard when delete button is clicked', () => {
    const onDeleteCard = vi.fn();
    render(<BoardCardGrid {...defaultProps} onDeleteCard={onDeleteCard} />);

    // Find and click the delete button for the first card
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

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

  it('should disable buttons when card is processing', () => {
    const processingCards = [
      {
        ...mockCards[0],
        isProcessing: true,
      },
    ];

    render(<BoardCardGrid {...defaultProps} cards={processingCards} />);

    const editButton = screen.getByText('Edit');
    const deleteButton = screen.getByText('Delete');

    expect(editButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });
});
