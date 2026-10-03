import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditLabelButton } from '@/app/(admin)/admin/components/edit-label-button';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: /edit label/i }));
  return screen.getByRole('textbox', { name: /label/i });
}

describe('EditLabelButton', () => {
  it('opens prefilled with the current label', () => {
    render(<EditLabelButton cardId="c1" cardNumber={3} label="El Gato" />);
    expect(openDialog()).toHaveValue('El Gato');
  });

  it('PUTs the trimmed label, reports it, and refreshes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();
    render(<EditLabelButton cardId="c1" cardNumber={3} label="El Gato" onSaved={onSaved} />);
    fireEvent.change(openDialog(), { target: { value: '  La Gata ' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/cards/c1/label', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'La Gata' }),
    });
    expect(onSaved).toHaveBeenCalledWith('La Gata');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('blocks an empty label without a request', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<EditLabelButton cardId="c1" cardNumber={3} label="El Gato" />);
    fireEvent.change(openDialog(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/label is required/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('closes without a request when the label is unchanged', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<EditLabelButton cardId="c1" cardNumber={3} label="El Gato" />);
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the dialog open with an error when the save fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const onSaved = vi.fn();
    render(<EditLabelButton cardId="c1" cardNumber={3} label="El Gato" onSaved={onSaved} />);
    fireEvent.change(openDialog(), { target: { value: 'La Gata' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to save label/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('icon variant has a descriptive accessible name', () => {
    render(<EditLabelButton cardId="c1" cardNumber={7} label="La Luna" variant="icon" />);
    expect(screen.getByRole('button', { name: 'Edit label for card #7' })).toBeInTheDocument();
  });
});
