import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UseOriginalButton } from '@/app/(admin)/admin/components/use-original-button';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UseOriginalButton', () => {
  it('asks for confirmation before sending anything', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<UseOriginalButton cardId="c1" />);
    fireEvent.click(screen.getByRole('button', { name: /use original photo/i }));
    expect(screen.getByText(/discard ai drawing\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancel returns to the initial button without a request', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<UseOriginalButton cardId="c1" />);
    fireEvent.click(screen.getByRole('button', { name: /use original photo/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByRole('button', { name: /use original photo/i })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs and refreshes on confirm', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<UseOriginalButton cardId="c1" />);
    fireEvent.click(screen.getByRole('button', { name: /use original photo/i }));
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/cards/c1/use-original', {
      method: 'POST',
    });
  });

  it('shows an error and keeps the confirm step when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<UseOriginalButton cardId="c1" />);
    fireEvent.click(screen.getByRole('button', { name: /use original photo/i }));
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to use original photo/i);
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
