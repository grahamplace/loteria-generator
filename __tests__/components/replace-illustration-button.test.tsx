import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReplaceIllustrationButton } from '@/app/(admin)/admin/components/replace-illustration-button';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

function selectFile() {
  const input = screen.getByLabelText(/replace illustration/i);
  const file = new File(['x'], 'photo.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ReplaceIllustrationButton', () => {
  it('renders the replace control', () => {
    render(<ReplaceIllustrationButton cardId="c1" />);
    expect(screen.getByText(/replace illustration/i)).toBeInTheDocument();
  });

  it('opens a confirm modal with a preview when a file is selected', () => {
    render(<ReplaceIllustrationButton cardId="c1" />);
    selectFile();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^replace$/i })).toBeInTheDocument();
  });

  it('PUTs the base64 payload and refreshes on confirm', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReplaceIllustrationButton cardId="c1" />);
    selectFile();
    fireEvent.click(screen.getByRole('button', { name: /^replace$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cards/c1/illustration',
      expect.objectContaining({ method: 'PUT' })
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.illustrationBase64).toMatch(/^data:image\/png;base64,/);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('cancel closes the modal without a request', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ReplaceIllustrationButton cardId="c1" />);
    selectFile();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a size error and does not open the modal for an oversized file', () => {
    render(<ReplaceIllustrationButton cardId="c1" />);
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText(/replace illustration/i), { target: { files: [big] } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/exceeds maximum size/i);
  });
});
