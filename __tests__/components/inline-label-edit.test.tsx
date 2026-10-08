import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { InlineLabelEdit } from '@/app/(admin)/admin/components/inline-label-edit';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function startEditing() {
  fireEvent.click(screen.getByRole('button', { name: /rename card #26/i }));
  return screen.getByRole('textbox', { name: /label for card #26/i });
}

describe('InlineLabelEdit', () => {
  it('shows "#n — label" and turns into a prefilled input on click', () => {
    render(<InlineLabelEdit cardId="c1" cardNumber={26} label="La Margarita" />);
    expect(screen.getByRole('heading')).toHaveTextContent(/#26 —\s*La Margarita/);
    expect(startEditing()).toHaveValue('La Margarita');
  });

  it('saves the trimmed label on blur', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();
    render(<InlineLabelEdit cardId="c1" cardNumber={26} label="La Margarita" onSaved={onSaved} />);
    const input = startEditing();
    fireEvent.change(input, { target: { value: '  La Rosa ' } });
    fireEvent.blur(input);

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('La Rosa'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cards/c1/label',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ label: 'La Rosa' }) })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('Escape cancels without saving', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<InlineLabelEdit cardId="c1" cardNumber={26} label="La Margarita" />);
    const input = startEditing();
    fireEvent.change(input, { target: { value: 'La Rosa' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading')).toHaveTextContent(/#26 —\s*La Margarita/);
  });

  it('rejects an empty label and keeps the old one', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<InlineLabelEdit cardId="c1" cardNumber={26} label="La Margarita" />);
    const input = startEditing();
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(screen.getByRole('heading')).toHaveTextContent(/#26 —\s*La Margarita/);
  });

  it('restores the old label when the save fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<InlineLabelEdit cardId="c1" cardNumber={26} label="La Margarita" />);
    const input = startEditing();
    fireEvent.change(input, { target: { value: 'La Rosa' } });
    fireEvent.blur(input);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole('heading')).toHaveTextContent(/#26 —\s*La Margarita/);
  });
});
