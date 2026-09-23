import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminBulkUpload } from '@/app/(admin)/admin/components/admin-bulk-upload';
import { downscaleToDataUrl } from '@/lib/downscale-image';
import { MAX_REQUEST_BODY_BYTES } from '@/lib/upload-limits';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/app/(admin)/admin/components/image-crop-modal', () => ({
  ImageCropModal: () => null,
}));

// jsdom has no createImageBitmap/canvas, so stub the resize step.
vi.mock('@/lib/downscale-image', () => ({ downscaleToDataUrl: vi.fn() }));

const SMALL_DATA_URL = 'data:image/jpeg;base64,AAAA';

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn((f: Blob) => `blob:${(f as File).name}`);
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.mocked(downscaleToDataUrl).mockResolvedValue({ dataUrl: SMALL_DATA_URL, scale: 1 });
});

function selectFiles(...names: string[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const files = names.map((n) => new File(['x'], n, { type: 'image/jpeg' }));
  fireEvent.change(input, { target: { files } });
}

/** Board creation succeeds; each card POST answers with the next response. */
function mockFetch(cardResponses: Array<{ status: number; json?: unknown }>) {
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 201,
    json: async () => ({ board: { id: 'b1' } }),
  });
  for (const r of cardResponses) {
    fetchMock.mockResolvedValueOnce({
      ok: r.status < 400,
      status: r.status,
      json: async () => {
        if (r.json === undefined) throw new SyntaxError('Unexpected token');
        return r.json;
      },
    });
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function clickCreate() {
  fireEvent.click(screen.getByRole('button', { name: /create board/i }));
}

describe('AdminBulkUpload', () => {
  it('renders with the filename-label toggle on by default', () => {
    render(<AdminBulkUpload />);
    const toggle = screen.getByRole('checkbox', { name: /use filename as label/i });
    expect(toggle).toBeChecked();
  });

  it('defaults the board name to "Admin Board"', () => {
    render(<AdminBulkUpload />);
    const nameInput = screen.getByLabelText(/board name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Admin Board');
  });

  it('shows a disabled create button until files are selected', () => {
    render(<AdminBulkUpload />);
    const button = screen.getByRole('button', { name: /create board/i });
    expect(button).toBeDisabled();
  });

  it('defaults "Re-illustrate with AI" to OFF (preserve as-is)', () => {
    render(<AdminBulkUpload />);
    const toggle = screen.getByRole('checkbox', { name: /re-illustrate with ai/i });
    expect(toggle).not.toBeChecked();
  });

  it('redirects to the board when every file uploads', async () => {
    mockFetch([
      { status: 201, json: { card: {} } },
      { status: 201, json: { card: {} } },
    ]);
    render(<AdminBulkUpload />);
    selectFiles('a.jpg', 'b.jpg');
    clickCreate();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/boards/b1'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stays on the page and names the file when the platform rejects it with a 413', async () => {
    mockFetch([{ status: 201, json: { card: {} } }, { status: 413 }]);
    render(<AdminBulkUpload />);
    selectFiles('ok.jpg', 'La Nieve.jpg');
    clickCreate();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('1 of 2 files failed to upload');
    expect(alert).toHaveTextContent(/La Nieve\.jpg: Too large to upload/);
    expect(screen.getByRole('link', { name: /open board \(1 card uploaded\)/i })).toHaveAttribute(
      'href',
      '/admin/boards/b1'
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('skips the request and reports the size when the resized image is still too large', async () => {
    vi.mocked(downscaleToDataUrl).mockResolvedValue({
      dataUrl: `data:image/jpeg;base64,${'A'.repeat(MAX_REQUEST_BODY_BYTES)}`,
      scale: 0.5,
    });
    const fetchMock = mockFetch([]);
    render(<AdminBulkUpload />);
    selectFiles('huge.jpg');
    clickCreate();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      /huge\.jpg: Too large to upload: 4\.5MB, over the 4\.5MB limit/
    );
    expect(alert).toHaveTextContent(/board was created but has no cards/i);
    // Only the board was created; the oversized card never hit the network.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the API validation message for a rejected image', async () => {
    mockFetch([
      {
        status: 400,
        json: {
          error: 'Invalid request',
          details: { fieldErrors: { originalImageBase64: ['Image exceeds maximum size of 10MB'] } },
        },
      },
    ]);
    render(<AdminBulkUpload />);
    selectFiles('photo.jpg');
    clickCreate();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('photo.jpg: Image exceeds maximum size of 10MB');
  });
});
