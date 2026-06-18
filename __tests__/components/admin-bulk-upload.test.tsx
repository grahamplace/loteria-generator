import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminBulkUpload } from '@/app/(admin)/admin/components/admin-bulk-upload';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

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
});
