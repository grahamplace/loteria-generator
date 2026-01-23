import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardUploadSection } from '@/components/board-upload-section';

describe('BoardUploadSection', () => {
  const defaultProps = {
    onFilesSelected: vi.fn(),
    cardCount: 0,
    maxCards: 16,
    isUnlocked: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render upload section', () => {
    render(<BoardUploadSection {...defaultProps} />);

    expect(screen.getByText('Upload your photos')).toBeInTheDocument();
    expect(screen.getByText(/16 slots available/)).toBeInTheDocument();
  });

  it('should show remaining slots correctly', () => {
    render(<BoardUploadSection {...defaultProps} cardCount={5} />);

    expect(screen.getByText(/11 slots available/)).toBeInTheDocument();
    expect(screen.getByText('Photos uploaded: 5/16')).toBeInTheDocument();
  });

  it('should show limit reached message when at max cards', () => {
    render(<BoardUploadSection {...defaultProps} cardCount={16} />);

    expect(screen.getByText(/Free tier limit reached/)).toBeInTheDocument();
    expect(screen.getByText('Unlock this board to add up to 54 cards')).toBeInTheDocument();
  });

  it('should show different message for unlocked board at max', () => {
    render(<BoardUploadSection {...defaultProps} cardCount={54} maxCards={54} isUnlocked={true} />);

    expect(screen.getByText(/Maximum cards reached/)).toBeInTheDocument();
    expect(screen.getByText("You've reached the maximum of 54 cards")).toBeInTheDocument();
  });

  it('should call onFilesSelected when files are selected', () => {
    const onFilesSelected = vi.fn();
    render(<BoardUploadSection {...defaultProps} onFilesSelected={onFilesSelected} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'test.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('should filter non-image files', () => {
    const onFilesSelected = vi.fn();
    render(<BoardUploadSection {...defaultProps} onFilesSelected={onFilesSelected} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const imageFile = new File(['test'], 'test.png', { type: 'image/png' });
    const textFile = new File(['test'], 'test.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [imageFile, textFile] } });

    expect(onFilesSelected).toHaveBeenCalledWith([imageFile]);
  });

  it('should limit files to remaining slots', () => {
    const onFilesSelected = vi.fn();
    render(
      <BoardUploadSection {...defaultProps} cardCount={14} onFilesSelected={onFilesSelected} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      new File(['test'], 'test1.png', { type: 'image/png' }),
      new File(['test'], 'test2.png', { type: 'image/png' }),
      new File(['test'], 'test3.png', { type: 'image/png' }),
    ];

    fireEvent.change(input, { target: { files } });

    // Should only allow 2 files (16 - 14 = 2 remaining slots)
    expect(onFilesSelected).toHaveBeenCalledWith([files[0], files[1]]);
  });

  it('should disable input when max reached', () => {
    render(<BoardUploadSection {...defaultProps} cardCount={16} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('should show unlock prompt message for locked boards near limit', () => {
    render(<BoardUploadSection {...defaultProps} cardCount={16} isUnlocked={false} />);

    expect(screen.getByText('Unlock for up to 54 cards')).toBeInTheDocument();
  });
});
