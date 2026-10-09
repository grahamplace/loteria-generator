import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Card } from '@/db/schema';

const generateLoteriaSetPdf = vi.fn(async () => new Blob(['pdf']));

vi.mock('@/lib/generate-boards', () => ({
  generateLoteriaSetPdf: (...args: unknown[]) => generateLoteriaSetPdf(...(args as [])),
  clampBoardCount: (n: number) => n,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/admin-card-image', () => ({
  adminCardImageSrc: (c: { illustrationUrl: string | null }) => c.illustrationUrl,
}));

import { AdminExportButton } from '@/app/(admin)/admin/components/admin-export-button';

const cards = Array.from({ length: 16 }, (_, i) => ({
  id: `card-${i}`,
  number: i + 1,
  label: `Card ${i + 1}`,
  status: 'completed',
  illustrationUrl: `/img/${i}.webp`,
  riddle: null,
})) as unknown as Card[];

describe('AdminExportButton', () => {
  beforeEach(() => {
    generateLoteriaSetPdf.mockClear();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  it('exports without a title when unchecked', async () => {
    render(<AdminExportButton boardName="Boda de Ana" cards={cards} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(generateLoteriaSetPdf).toHaveBeenCalledTimes(1));
    const args = generateLoteriaSetPdf.mock.calls[0] as unknown[];
    expect(args[5]).toEqual({ boardTitle: undefined });
  });

  it('uses the persisted title setting', async () => {
    render(
      <AdminExportButton
        boardName="Boda de Ana"
        cards={cards}
        styleOptions={{ presetId: 'wedding', showTitle: true }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(generateLoteriaSetPdf).toHaveBeenCalledTimes(1));
    const args = generateLoteriaSetPdf.mock.calls[0] as unknown[];
    expect(args[5]).toEqual({ boardTitle: 'Boda de Ana' });
  });
});
